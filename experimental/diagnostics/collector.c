// SPDX-License-Identifier: GPL-3.0-or-later
// Read-only, fixed allowlist. This payload never installs, patches, or deletes.
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <stdint.h>
#include <errno.h>
#include <string.h>
#include <signal.h>
#ifndef DIAG_HOST_TEST
#include <ps5/kernel.h>
#else
static unsigned kernel_get_fw_version(void){return 0x13600000;}
#endif
#include "sha256.h"
#ifndef DIAGNOSTIC_DATA_ROOT
#define DIAGNOSTIC_DATA_ROOT "/data"
#endif
static const char *files[]={
 "etaHEN/experimental-diagnostics/trace.log.3","etaHEN/experimental-diagnostics/trace.log.2",
 "etaHEN/experimental-diagnostics/trace.log.1","etaHEN/experimental-diagnostics/trace.log",
 "etaHEN/bootstrap-experimental.previous.log","etaHEN/bootstrap-experimental.log",
 "etaHEN/etaHEN.previous.log","etaHEN/etaHEN.log",
 "etaHEN/etaHEN_util_daemon.previous.log","etaHEN/etaHEN_util_daemon.log",
 "etaHEN/etaHEN_crash.previous.log","etaHEN/etaHEN_crash.log",
 "etaHEN/etaHEN_util_crash.previous.log","etaHEN/etaHEN_util_crash.log",
 "snipers-youtube-handoff-startup.log"
};
static unsigned char data[2048];static char hex[4097];
static void encode(const unsigned char *p,size_t n,char *out){const char *digits="0123456789abcdef";for(size_t i=0;i<n;i++){out[i*2]=digits[p[i]>>4];out[i*2+1]=digits[p[i]&15];}out[n*2]=0;}
static int emit(const char *line){return fputs(line,stdout)<0||fflush(stdout)?-1:0;}
static int open_log(const char *name){
 // Walk fixed relative names using directory descriptors. Symlinked parent
 // directories cannot redirect the collector to unrelated console files.
 int dir=open(DIAGNOSTIC_DATA_ROOT,O_RDONLY|O_DIRECTORY);if(dir<0)return -1;
 char path[256];snprintf(path,sizeof path,"%s",name);char *part=path,*slash;
 while((slash=strchr(part,'/'))){*slash=0;int next=openat(dir,part,O_RDONLY|O_DIRECTORY|O_NOFOLLOW);close(dir);if(next<0)return -1;dir=next;part=slash+1;}
 int fd=openat(dir,part,O_RDONLY|O_NOFOLLOW|O_NONBLOCK);int error=errno;close(dir);errno=error;return fd;
}
int main(void){
 signal(SIGPIPE,SIG_IGN);setvbuf(stdout,NULL,_IONBF,0);
 char line[512];snprintf(line,sizeof line,"SNPR_DIAG_META={\"schema\":1,\"firmwareRaw\":%u}\n",kernel_get_fw_version());if(emit(line))return 1;
 int found=0;
 for(unsigned i=0;i<sizeof(files)/sizeof(files[0]);i++){
  int fd=open_log(files[i]);struct stat st;
  if(fd<0){snprintf(line,sizeof line,"SNPR_DIAG_SKIP={\"name\":\"%s\",\"errno\":%d}\n",files[i],errno);if(emit(line))return 1;continue;}
  if(fstat(fd,&st)||!S_ISREG(st.st_mode)||st.st_nlink!=1||st.st_size<0){close(fd);snprintf(line,sizeof line,"SNPR_DIAG_SKIP={\"name\":\"%s\",\"errno\":%d}\n",files[i],EINVAL);if(emit(line))return 1;continue;}
  off_t limit=i<4?1024*1024:64*1024,offset=st.st_size>limit?st.st_size-limit:0;size_t remaining=(size_t)(st.st_size-offset);
  if(lseek(fd,offset,SEEK_SET)<0){close(fd);return 1;}
  snprintf(line,sizeof line,"SNPR_DIAG_FILE={\"name\":\"%s\",\"totalBytes\":%lld,\"offset\":%lld,\"mtime\":%lld}\n",files[i],(long long)st.st_size,(long long)offset,(long long)st.st_mtime);
  if(emit(line)){close(fd);return 1;}
  SHA256_CTX hash;sha256_init(&hash);
  while(remaining){size_t want=remaining<sizeof data?remaining:sizeof data;ssize_t n=read(fd,data,want);if(n<0&&errno==EINTR)continue;if(n<=0){close(fd);return 1;}
   sha256_update(&hash,data,(size_t)n);encode(data,(size_t)n,hex);
   if(emit("SNPR_DIAG_DATA=")||emit(hex)||emit("\n")){close(fd);return 1;}remaining-=(size_t)n;
  }
  unsigned char digest[32];sha256_final(&hash,digest);encode(digest,32,hex);close(fd);
  snprintf(line,sizeof line,"SNPR_DIAG_END=%s\n",hex);if(emit(line))return 1;found++;
 }
 snprintf(line,sizeof line,"SNPR_OPTION_MESSAGE=%s\nSNPR_OPTION_RESULT=%d\n",found?"Diagnostics collected. Uploading securely from this browser.":"No diagnostic logs found. Use the new experimental etaHEN build first.",found?0:-1);
 return emit(line)?1:0;
}
