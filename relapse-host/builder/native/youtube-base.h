// SPDX-License-Identifier: GPL-3.0-or-later
// Submit only the pinned YouTube package to etaHEN DPIv2 on loopback.
static int youtube_metadata(void){
 int fd=open("/system_data/priv/appmeta/PPSA01650/param.json",O_RDONLY|O_NOFOLLOW);
 if(fd<0)return errno==ENOENT?0:-1;
 char text[32768];struct stat st;
 if(fstat(fd,&st)||!S_ISREG(st.st_mode)||st.st_size<=0||st.st_size>=(off_t)sizeof text){close(fd);return -1;}
 size_t done=0;while(done<(size_t)st.st_size){ssize_t n=read(fd,text+done,(size_t)st.st_size-done);if(n<=0){close(fd);return -1;}done+=(size_t)n;}close(fd);text[done]=0;
 json_t pool[256];const json_t *j=json_create(text,pool,256);if(!j)return -1;
 const json_t *title=json_getProperty(j,"titleId"),*version=json_getProperty(j,"contentVersion");
 if(!title||!version||json_getType(title)!=JSON_TEXT||json_getType(version)!=JSON_TEXT)return -1;
 return !strcmp(json_getValue(title),"PPSA01650")&&!strcmp(json_getValue(version),"01.000.030")?1:-1;
}
static int submit_youtube_dpi(void){
 int sock=socket(AF_INET,SOCK_STREAM,0);if(sock<0)return -1;
 struct timeval timeout={10,0};setsockopt(sock,SOL_SOCKET,SO_RCVTIMEO,&timeout,sizeof timeout);setsockopt(sock,SOL_SOCKET,SO_SNDTIMEO,&timeout,sizeof timeout);
 struct sockaddr_in address={0};address.sin_len=sizeof address;address.sin_family=AF_INET;address.sin_port=htons(12800);address.sin_addr.s_addr=htonl(0x7f000001);
 if(connect(sock,(struct sockaddr*)&address,sizeof address)){close(sock);return -1;}
 // The latch is made before sending: an uncertain response must never resubmit.
 int latch=open("/system_tmp/snipers-youtube-package-request",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0600);
 if(latch<0){close(sock);return 1;}close(latch);
 const char *body="url=http%3A%2F%2Fsniperscheats.lol%2Fyoutube-packages%2FYouTube-PPSA01650-01.000.030.pkg&content_name=YouTube";
 char request[1024];int n=snprintf(request,sizeof request,"POST /upload HTTP/1.1\r\nHost: 127.0.0.1:12800\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: %zu\r\nConnection: close\r\n\r\n%s",strlen(body),body);
 if(n<=0||n>=(int)sizeof request||exact_write(sock,request,(size_t)n)){close(sock);return -2;}
 char response[8192];size_t used=0;
 while(used+1<sizeof response){ssize_t got=read(sock,response+used,sizeof response-used-1);if(got<0&&errno==EINTR)continue;if(got<=0)break;used+=(size_t)got;}
 close(sock);response[used]=0;
 if(!strncmp(response,"HTTP/1.1 200 ",13)&&strstr(response,"SUCCESS: Direct install console Task started"))return 0;
 return -2;
}
static int ensure_youtube_installed(int allow_install){
 uint32_t fw=0;size_t len=sizeof fw;if(sysctlbyname("kern.sdk_version",&fw,&len,NULL,0)||(fw>>16)!=0x1360){progress("This installer requires PS5 13.60.");return -1;}
 struct stat installed;
 int metadata=youtube_metadata();if(metadata==1&&!lstat("/user/app/PPSA01650/app.pkg",&installed)&&S_ISREG(installed.st_mode)&&installed.st_size>0)return 0;
 if(metadata<0){progress("An unsupported or unreadable YouTube version is installed. It was not replaced.");return -1;}
 if(!allow_install){progress("YouTube is not installed. Verification-only builds cannot install the app.");return -1;}
 struct statfs space;if(statfs("/user",&space)||space.f_bavail<0||space.f_bsize<=0||(uint64_t)space.f_bavail*(uint64_t)space.f_bsize<1024ULL*1024*1024){progress("Free at least 1 GiB of internal storage before installing YouTube.");return -1;}
 struct stat package;
 if(lstat("/user/app/PPSA01650/app.pkg",&package)&&errno==ENOENT){
  progress("YouTube is missing. Asking etaHEN DPIv2 to install the supported app.");
  int submitted=submit_youtube_dpi();
  if(submitted==-1){progress("Enable DPI v2 in etaHEN Toolbox, then try this install again.");return -1;}
  if(submitted==-2){progress("DPI did not confirm its request. Check console Downloads; this request will not be sent twice this boot.");return -1;}
 }else progress("A YouTube package is already present. Waiting for installation; no duplicate request sent.");
 static const unsigned char expected[32]={0xea,0xf0,0xba,0x5c,0x10,0x63,0x58,0x6c,0xcb,0xf7,0x6a,0x5b,0x7f,0xbd,0xfe,0xae,0xd4,0x59,0x91,0x17,0x64,0x60,0xba,0xad,0x87,0x22,0x2a,0xb6,0xbf,0x06,0xbb,0x80};
 // Exact bytes must be present and registered, not just a preallocated pkg file.
 for(int i=0;i<90;i++){
  if(youtube_metadata()==1&&!lstat("/user/app/PPSA01650/app.pkg",&package)&&S_ISREG(package.st_mode)&&package.st_size==101515264){
   unsigned char digest[32];uint64_t bytes;
   if(!hash_file("/user/app/PPSA01650/app.pkg",&bytes,digest)&&bytes==101515264&&!memcmp(digest,expected,32)){progress("YouTube package downloaded, registered and checksum verified.");return 0;}
  }
  if(i%3==0)progress("Waiting for YouTube package installation. Keep this page open.");
  sleep(5);
 }
 progress("YouTube installation has not finished. Check console Downloads before trying again.");return -1;
}
