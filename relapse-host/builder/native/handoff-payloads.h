// SPDX-License-Identifier: GPL-3.0-or-later
// Runs pinned in-memory payloads through the existing independent ELF loader.
// No mounts, downloads, executable patching, or automatic injection retries.
#include <poll.h>
#include <errno.h>
#include <stdlib.h>
#include "sha256.h"
#include "handoff-result.h"
#include "embedded-payloads.h"
static int verify_embedded_payloads(void){
 for(size_t i=0;i<sizeof(payloads)/sizeof(payloads[0]);i++){
  const struct embedded_payload *p=&payloads[i];uint8_t digest[32];SHA256_CTX hash;
  if(p->bytes<64||memcmp(p->data,"\177ELF\2\1",6)||p->data[18]!=62||p->data[19])return -1;
  sha256_init(&hash);sha256_update(&hash,p->data,p->bytes);sha256_final(&hash,digest);
  if(memcmp(digest,p->hash,32)||record(p->label,(int)p->bytes))return -1;
 }
 return 0;
}
static long long monotonic_ms(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t))return -1;return (long long)t.tv_sec*1000+t.tv_nsec/1000000;}
static int payload_socket(void){
 int fd=socket(AF_INET,SOCK_STREAM,0);if(fd<0)return -1;
 struct timeval sendtime={5,0},recvtime={1,0};
 if(setsockopt(fd,SOL_SOCKET,SO_SNDTIMEO,&sendtime,sizeof sendtime)||setsockopt(fd,SOL_SOCKET,SO_RCVTIMEO,&recvtime,sizeof recvtime)){close(fd);return -1;}
 struct sockaddr_in a={0};a.sin_len=sizeof a;a.sin_family=AF_INET;a.sin_port=htons(9021);a.sin_addr.s_addr=htonl(0x7f000001);
 // The local loader is already established by kernel handoff. Never probe it
 // with an empty connection, and never reconnect after any transfer attempt.
 if(connect(fd,(struct sockaddr*)&a,sizeof a)){close(fd);return -1;}return fd;
}
static int run_embedded_payloads(void){
 for(size_t i=0;i<sizeof(payloads)/sizeof(payloads[0]);i++){
  const struct embedded_payload *p=&payloads[i];if(record(p->label,-1))return -1;
  int fd=payload_socket();if(fd<0){record("loader connect failed",errno);return -1;}
  long long started=monotonic_ms();if(started<0){close(fd);return -1;}
  size_t sent=0;while(sent<p->bytes){
   long long now=monotonic_ms();if(now<0||now-started>30000){close(fd);return -1;}
   size_t amount=p->bytes-sent;if(amount>65536)amount=65536;
   ssize_t n=send(fd,p->data+sent,amount,MSG_NOSIGNAL);if(n<=0){record("payload send failed",errno);close(fd);return -1;}sent+=(size_t)n;
  }
  if(shutdown(fd,SHUT_WR)){close(fd);return -1;}
  if(p->acknowledgement!=1){close(fd);if(record(p->acknowledgement==0?"etaHEN dispatched; waiting for readiness supervisor":"Custom payload sent; readiness not reported",0))return -1;continue;}
  char line[1024];size_t used=0,total=0;int result=0;
  long long wait_start=monotonic_ms();if(wait_start<0){close(fd);return -1;}
  while(!result&&total<65536){
   long long now=monotonic_ms();if(now<0||now-wait_start>150000)break;
   struct pollfd poller={fd,POLLIN,0};int ready=poll(&poller,1,1000);
   if(ready<0){if(errno==EINTR)continue;break;}if(!ready)continue;
   if(!(poller.revents&POLLIN))break;
   char chunk[512];ssize_t n=recv(fd,chunk,sizeof chunk,0);
   if(n<0&&(errno==EINTR||errno==EAGAIN))continue;if(n<=0)break;
   total+=(size_t)n;
   for(ssize_t j=0;j<n;j++){
    if(chunk[j]=='\n'){
     if(used&&line[used-1]=='\r')used--;line[used]=0;
     if(record(line,0)){result=-1;break;}
     result=handoff_result(line);used=0;if(result)break;
    }else if(used+1<sizeof line&&chunk[j])line[used++]=chunk[j];
    else {result=-1;break;}
   }
  }
  close(fd);if(result!=1){record("payload readiness not confirmed; sequence stopped",(int)i);return -1;}
  if(record("payload readiness confirmed",(int)i))return -1;
 }
 return 0;
}
