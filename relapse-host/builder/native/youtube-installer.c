// SPDX-License-Identifier: GPL-3.0-or-later
// Website-hosted native PS5 payload. Fixed YouTube destination; pinned download.
#define SNIPERS_INSTALLER
static void progress(const char *message);
#include "youtube-preflight.c"
#include <sys/socket.h>
#include <sys/file.h>
#include <netinet/in.h>
#include <poll.h>
#include <strings.h>
#include <errno.h>
#include <signal.h>
#include <time.h>
#include "sha256.h"

struct __attribute__((packed)) installer_config {
 char magic[16];uint32_t mode,address;uint16_t port,reserved;uint64_t bytes;
 unsigned char hash[32];char job[33],host[128],path[256];
};
_Static_assert(sizeof(struct installer_config)==485,"Installer configuration ABI");
// Patched by the trusted build server; never accept destinations from a request.
volatile struct installer_config config={.magic="SNPRYTINSTALL01"};
static const char *root="/user/download/PPSA01650";
static const char *target="/user/download/PPSA01650/download0.dat";
static unsigned char buffer[65536];
static int log_fd=-1;
static void saved(const char *text){if(log_fd<0)return;size_t remaining=strlen(text);while(remaining){ssize_t n=write(log_fd,text,remaining);if(n<0&&errno==EINTR)continue;if(n<=0)break;text+=n;remaining-=(size_t)n;}}
#include "installer-status.h"
static const char *download_failure="Download or checksum verification failed. Existing YouTube startup preserved.";
static int safe_text(const char *s,size_t cap,int path){
 size_t n=strnlen(s,cap);if(!n||n==cap)return 0;
 for(size_t i=0;i<n;i++)if(!((s[i]>='a'&&s[i]<='z')||(s[i]>='A'&&s[i]<='Z')||(s[i]>='0'&&s[i]<='9')||s[i]=='.'||s[i]=='-'||(path&&(s[i]=='/'||s[i]=='_'))))return 0;
 return !strstr(s,"..");
}
static int exact_write(int fd,const void *data,size_t length){const unsigned char *p=data;while(length){ssize_t n=write(fd,p,length);if(n<0&&errno==EINTR)continue;if(n<=0)return -1;p+=n;length-=(size_t)n;}return 0;}
static int hash_file(const char *path,uint64_t *size,unsigned char out[32]){
 int fd=open(path,O_RDONLY|O_NOFOLLOW);if(fd<0)return -1;struct stat st;
 if(fstat(fd,&st)||!S_ISREG(st.st_mode)||st.st_size<0){close(fd);return -1;}
 SHA256_CTX hash;sha256_init(&hash);*size=0;ssize_t n;
 while((n=read(fd,buffer,sizeof buffer))>0){sha256_update(&hash,buffer,(size_t)n);*size+=(uint64_t)n;}
 close(fd);if(n<0||*size!=(uint64_t)st.st_size)return -1;sha256_final(&hash,out);return 0;
}
static int copy_backup(const char *path,const struct stat *original){
 int in=open(target,O_RDONLY|O_NOFOLLOW);if(in<0)return -1;
 int out=open(path,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0600);if(out<0){close(in);return -1;}
 int ok=0;ssize_t n;while((n=read(in,buffer,sizeof buffer))>0)if(exact_write(out,buffer,(size_t)n)){ok=-1;break;}
 if(n<0||fchown(out,original->st_uid,original->st_gid)||fchmod(out,original->st_mode&0777)||fsync(out))ok=-1;
 if(close(out))ok=-1;close(in);return ok;
}
static int download(const struct installer_config *c,int out){
 int sock=socket(AF_INET,SOCK_STREAM,0);if(sock<0)return -1;
 struct timeval timeout={20,0};setsockopt(sock,SOL_SOCKET,SO_RCVTIMEO,&timeout,sizeof timeout);setsockopt(sock,SOL_SOCKET,SO_SNDTIMEO,&timeout,sizeof timeout);
 struct sockaddr_in addr={0};addr.sin_len=sizeof addr;addr.sin_family=AF_INET;addr.sin_addr.s_addr=c->address;addr.sin_port=c->port;
 // Connect nonblocking with a bounded deadline, even for an unreachable server.
 int flags=fcntl(sock,F_GETFL,0);if(flags<0||fcntl(sock,F_SETFL,flags|O_NONBLOCK)){close(sock);return -1;}
 if(connect(sock,(struct sockaddr*)&addr,sizeof addr)){if(errno!=EINPROGRESS){close(sock);return -1;}struct pollfd p={.fd=sock,.events=POLLOUT};
  if(poll(&p,1,20000)<=0){close(sock);return -1;}int e=0;socklen_t len=sizeof e;if(getsockopt(sock,SOL_SOCKET,SO_ERROR,&e,&len)||e){close(sock);return -1;}}
 if(fcntl(sock,F_SETFL,flags)){close(sock);return -1;}
 char header[8192];int count=snprintf(header,sizeof header,"GET %s HTTP/1.1\r\nHost: %s\r\nConnection: close\r\nAccept-Encoding: identity\r\n\r\n",c->path,c->host);
 if(count<0||(size_t)count>=sizeof header||exact_write(sock,header,(size_t)count)){close(sock);return -1;}
 size_t used=0;time_t deadline=time(NULL)+600;
 while(used+1<sizeof header){if(time(NULL)>deadline||read(sock,header+used,1)!=1){close(sock);return -1;}used++;if(used>=4&&!memcmp(header+used-4,"\r\n\r\n",4))break;}
 header[used]=0;
 if(used+1==sizeof header||strncmp(header,"HTTP/1.1 200 ",13)&&strncmp(header,"HTTP/1.0 200 ",13)){
  if(used>=12&&(!strncmp(header+9,"404",3)||!strncmp(header+9,"410",3)))download_failure="This build expired or is no longer available. Build a new bundle on the website and download its new installer ELF.";
  close(sock);return -1;
 }
 uint64_t length=0;int lengths=0;char *line=strstr(header,"\r\n");
 while(line&&line[2]){line+=2;char *end=strstr(line,"\r\n");if(!end)break;*end=0;
  if(!strncasecmp(line,"Content-Length:",15)){char *p=line+15;while(*p==' '||*p=='\t')p++;if(!*p){close(sock);return -1;}
   uint64_t value=0;for(;*p;p++){if(*p<'0'||*p>'9'||value>512ULL*1024*1024){close(sock);return -1;}value=value*10+(unsigned)(*p-'0');}length=value;lengths++;}
  if(!strncasecmp(line,"Transfer-Encoding:",18)||!strncasecmp(line,"Content-Encoding:",17)){close(sock);return -1;}
  line=end;
 }
 if(lengths!=1||length!=c->bytes){close(sock);return -1;}
 SHA256_CTX hash;sha256_init(&hash);uint64_t received=0,next=32*1024*1024;int ok=0;
 while(received<c->bytes){size_t want=sizeof buffer;if(c->bytes-received<want)want=(size_t)(c->bytes-received);
  if(time(NULL)>deadline){ok=-1;break;}ssize_t n=read(sock,buffer,want);if(n<0&&errno==EINTR)continue;
  if(n<=0||exact_write(out,buffer,(size_t)n)){ok=-1;break;}sha256_update(&hash,buffer,(size_t)n);received+=(uint64_t)n;
  if(received>=next){char message[96];snprintf(message,sizeof message,"Downloading startup image: %llu%%",(unsigned long long)(received*100/c->bytes));progress(message);next+=32*1024*1024;}
 }
 close(sock);unsigned char digest[32];sha256_final(&hash,digest);
 return ok||received!=c->bytes||memcmp(digest,c->hash,32)?-1:0;
}
#include "youtube-base.h"
int main(void){
 signal(SIGPIPE,SIG_IGN);setvbuf(stdout,NULL,_IONBF,0);
 progress("Installer started. Keep YouTube closed while setup runs.");
 struct installer_config c;memcpy(&c,(const void*)&config,sizeof c);
 if((c.mode!=1&&c.mode!=2)||c.bytes!=336789504ULL||!c.address||!c.port||!safe_text(c.host,sizeof c.host,0)||!safe_text(c.path,sizeof c.path,1)||c.path[0]!='/'||strnlen(c.job,sizeof c.job)!=32)
  return result(-20,"Installer is not configured for a verified build.");
 for(int i=0;i<32;i++)if(!((c.job[i]>='a'&&c.job[i]<='f')||(c.job[i]>='0'&&c.job[i]<='9')))return result(-20,"Invalid build identity.");
 char logpath[160];snprintf(logpath,sizeof logpath,"/data/snipers-youtube-installer-%s.log",c.job);
 log_fd=open(logpath,O_WRONLY|O_CREAT|O_APPEND|O_NOFOLLOW,0600);
 if(log_fd>=0){struct stat logstat;if(fstat(log_fd,&logstat)||!S_ISREG(logstat.st_mode)||logstat.st_nlink!=1||logstat.st_size>65536){close(log_fd);log_fd=-1;}}
 progress("Checking this build and YouTube installation.");
 if(ensure_youtube_installed(c.mode==2)<0)return result(-27,last_progress);
 progress("Checking YouTube before downloading.");if(youtube_preflight()<0)return result(-21,last_progress);
 struct stat directory;
 if(lstat(root,&directory)){
  if(errno!=ENOENT||c.mode!=2||mkdir(root,0777)||lstat(root,&directory))return result(-22,"YouTube download directory is unavailable.");
 }
 if(!S_ISDIR(directory.st_mode))return result(-22,"YouTube download directory is not a regular directory.");
 char staged[256],backup[256],lockpath[256];snprintf(staged,sizeof staged,"%s/download0.dat.snipers-new-%s",root,c.job);snprintf(backup,sizeof backup,"%s/download0.dat.snipers-backup-%s",root,c.job);snprintf(lockpath,sizeof lockpath,"%s/.snipers-install.lock",root);
 int lock=open(lockpath,O_WRONLY|O_CREAT|O_NOFOLLOW,0600);if(lock<0)return result(-23,"Cannot open installation guard.");
 if(flock(lock,LOCK_EX|LOCK_NB)){close(lock);return result(-24,"Another installer is active. This request was not started.");}
 int code=-25;const char *message="Installation stopped before replacing YouTube. Existing startup preserved.";int output=-1;struct stat old={0};
 int exists=!lstat(target,&old);if(!exists&&errno!=ENOENT)goto done;
 if(exists&&(!S_ISREG(old.st_mode)||old.st_nlink!=1||old.st_size<=0||old.st_size>512*1024*1024))goto done;
 struct statfs space;if(statfs(root,&space)||space.f_bavail<0||space.f_bsize<=0||space.f_bsize>1048576||(uint64_t)space.f_bavail*(uint64_t)space.f_bsize<c.bytes+(exists?(uint64_t)old.st_size:0)+64*1024*1024ULL){message="Not enough space for the download and verified backup.";goto done;}
 unsigned char oldhash[32],digest[32];uint64_t oldsize=0,size=0;
 // A verification run never replaces the target, so hashing it adds no protection.
 if(c.mode!=1&&exists){progress("Verifying your existing startup before making changes.");if(hash_file(target,&oldsize,oldhash))goto done;}
 if(c.mode==1){
  struct stat previous;
  if(!lstat(staged,&previous)){
   progress("Checking the staged download from your previous attempt.");
   if(!S_ISREG(previous.st_mode)||previous.st_nlink!=1||hash_file(staged,&size,digest)||size!=c.bytes||memcmp(digest,c.hash,32)){message="An incomplete or different staged file exists. It was preserved; nothing replaced.";goto done;}
   code=0;message="Download and full storage verification passed. YouTube startup was not replaced.";goto done;
  }
  if(errno!=ENOENT)goto done;
 }
 output=open(staged,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0600);if(output<0){message="This build has a staged file from an earlier attempt. It was preserved; no automatic retry.";goto done;}
 progress("Downloading the selected startup image.");if(download(&c,output)){message=download_failure;goto done;}
 if(fchown(output,exists?old.st_uid:directory.st_uid,exists?old.st_gid:directory.st_gid)||fchmod(output,exists?(old.st_mode&0777):0644)||fsync(output))goto done;
 if(close(output)){output=-1;goto done;}output=-1;
 progress("Verifying the complete staged file from storage.");
 if(hash_file(staged,&size,digest)||size!=c.bytes||memcmp(digest,c.hash,32)){message="Stored download failed verification. Existing startup preserved.";goto done;}
 if(c.mode==1){code=0;message="Download and full storage verification passed. YouTube startup was not replaced.";goto done;}
 if(exists&&oldsize==size&&!memcmp(oldhash,digest,32)){code=1;message="This exact startup image is already installed. No replacement needed.";goto done;}
 progress("Checking YouTube again before backup and replacement.");if(youtube_preflight()<0){message="YouTube state changed during download. Existing startup preserved.";goto done;}
 if(exists){
  if(hash_file(target,&size,digest)||size!=oldsize||memcmp(digest,oldhash,32)){message="Existing startup changed during download. Nothing replaced.";goto done;}
  progress("Saving and verifying your previous startup image.");if(copy_backup(backup,&old)||hash_file(backup,&size,digest)||size!=oldsize||memcmp(digest,oldhash,32)){message="Backup verification failed. Existing startup preserved.";goto done;}
 }
 // Rename replaces the original only after the new image and backup are synced.
 if(youtube_preflight()<0){message="YouTube reopened before replacement. Existing startup and backup preserved.";goto done;}
 if(exists){if(hash_file(target,&size,digest)||size!=oldsize||memcmp(digest,oldhash,32))goto done;}
 else {struct stat check;if(!lstat(target,&check)||errno!=ENOENT)goto done;}
 if(rename(staged,target))goto done;
 int dirfd=open(root,O_RDONLY|O_DIRECTORY);int synced=dirfd>=0&&!fsync(dirfd);if(dirfd>=0)close(dirfd);
 if(!synced||hash_file(target,&size,digest)||size!=c.bytes||memcmp(digest,c.hash,32)){code=-26;message="Replacement occurred but final verification did not finish. Keep YouTube closed; backup retained for recovery.";goto done;}
 code=0;message="YouTube startup installed and verified. Reboot, then open YouTube.";
done:
 if(output>=0)close(output);flock(lock,LOCK_UN);close(lock);
 // Retain incomplete downloads and backups for diagnosis; never erase an old file.
 printf("SNPR_INSTALL_JOB=%s\n",c.job);return result(code,message);
}
