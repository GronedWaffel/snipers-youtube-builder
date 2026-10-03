// SPDX-License-Identifier: MIT
// Installation-route probe. Never changes the YouTube startup image.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <sys/time.h>
#include <orbis/libkernel.h>

static void notice(const char* text){
 OrbisNotificationRequest r={0};r.type=NotificationRequest;r.targetId=-1;
 snprintf(r.message,sizeof(r.message),"Snipers Setup: %s",text);
 sceKernelSendNotificationRequest(0,&r,sizeof(r),0);
}
static int connect_local(int port){
 int s=socket(AF_INET,SOCK_STREAM,0);if(s<0)return -1;
 struct timeval timeout={8,0};
 setsockopt(s,SOL_SOCKET,SO_RCVTIMEO,&timeout,sizeof(timeout));
 setsockopt(s,SOL_SOCKET,SO_SNDTIMEO,&timeout,sizeof(timeout));
 struct sockaddr_in a={0};a.sin_family=AF_INET;a.sin_port=htons(port);a.sin_addr.s_addr=htonl(0x7f000001);
 if(connect(s,(struct sockaddr*)&a,sizeof(a))){close(s);return -1;}return s;
}
static int send_all(int fd,const char* p,size_t n){while(n){ssize_t w=send(fd,p,n,0);if(w<=0)return -1;p+=w;n-=(size_t)w;}return 0;}
static int reply(int fd,char* out,size_t cap){
 for(int lines=0;lines<100;lines++){
  size_t n=0;char c;
  while(n+1<cap){if(recv(fd,&c,1,0)!=1)return -1;out[n++]=c;if(c=='\n')break;}
  out[n]=0;if(n<4||out[n-1]!='\n')return -1;
  if(out[0]>='1'&&out[0]<='5'&&out[3]==' ')return atoi(out);
 }return -1;
}
static int cmd(int fd,const char* text,char* answer){if(send_all(fd,text,strlen(text)))return -1;return reply(fd,answer,1024);}
static int passive(int fd){char b[1024];if(cmd(fd,"PASV\r\n",b)!=227)return -1;
 char* p=strchr(b,'(');int a,b1,c,d,h,l;
 if(!p||sscanf(p,"(%d,%d,%d,%d,%d,%d)",&a,&b1,&c,&d,&h,&l)!=6||h<0||h>255||l<0||l>255||!(h*256+l))return -1;
 return connect_local(h*256+l);
}
int main(void){
 notice("Compatibility check running. YouTube files will stay unchanged.");
 int ftp=connect_local(1337);char b[1024];
 if(ftp<0||reply(ftp,b,sizeof(b))!=220){notice("Could not reach etaHEN FTP on port 1337.");goto done;}
 int code=cmd(ftp,"USER anonymous\r\n",b);
 if(code==331)code=cmd(ftp,"PASS anonymous\r\n",b);
 if(code!=230||cmd(ftp,"TYPE I\r\n",b)!=200){notice("FTP sign-in failed.");goto done;}
 int data=passive(ftp);if(data<0){notice("FTP data connection failed.");goto done;}
 code=cmd(ftp,"RETR /system_data/priv/appmeta/PPSA01650/param.json\r\n",b);
 if(code!=150&&code!=125){close(data);notice("YouTube PPSA01650 is not installed.");goto done;}
 char json[32768];size_t n=0;ssize_t got;
 while(n+1<sizeof(json)&&(got=recv(data,json+n,sizeof(json)-n-1,0))>0)n+=(size_t)got;
 close(data);json[n]=0;
 if(reply(ftp,b,sizeof(b))!=226||!strstr(json,"PPSA01650")||!strstr(json,"01.000.030")){notice("YouTube version check failed.");goto done;}
 data=passive(ftp);if(data<0){notice("Report connection failed.");goto done;}
 code=cmd(ftp,"STOR /data/snipers-setup-probe.json\r\n",b);
 if(code!=125&&code!=150){close(data);notice("Could not save compatibility report.");goto done;}
 const char* report="{\"probe\":4,\"app\":\"TEST10001\",\"youtube\":\"PPSA01650\",\"version\":\"01.000.030\",\"ftp\":true,\"youtubeModified\":false}\n";
 int sent=send_all(data,report,strlen(report));shutdown(data,SHUT_WR);close(data);
 if(sent||reply(ftp,b,sizeof(b))!=226){notice("Could not verify report save.");goto done;}
 notice("Compatibility check passed. Return to the dashboard.");
done:
 if(ftp>=0)close(ftp);
 for(;;)sceKernelUsleep(1000000);
}
