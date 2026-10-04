#include <assert.h>
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <errno.h>
#define off_t int64_t
#define ssize_t int64_t
struct stat {int st_mode;off_t st_size;};
struct statfs {long long f_bavail,f_bsize;};
struct timeval {long tv_sec,tv_usec;};
struct sockaddr {int dummy;};
struct sockaddr_in {int sin_len,sin_family,sin_port;struct {uint32_t s_addr;} sin_addr;};
#define S_ISREG(mode) ((mode)==1)
#define O_RDONLY 0
#define O_WRONLY 1
#define O_CREAT 2
#define O_EXCL 4
#define O_NOFOLLOW 8
#define AF_INET 2
#define SOCK_STREAM 1
#define SOL_SOCKET 1
#define SO_RCVTIMEO 1
#define SO_SNDTIMEO 2
#define JSON_TEXT 1
typedef struct {int field;} json_t;
static int tick,appears,finishes,posts,connects,latch,offline,reply,corrupt,wrong,latch_error;
static int socket(int a,int b,int c){return 4;}
static int setsockopt(int a,int b,int c,const void*d,size_t e){return 0;}
static int connect(int a,const struct sockaddr*b,size_t c){connects++;return offline?-1:0;}
static int close(int fd){return 0;}
static uint32_t htonl(uint32_t n){return n;}
static int htons(int n){return n;}
static int open(const char *path,int flags,...){
 if(strstr(path,"param.json")){if(wrong||tick>=finishes)return 3;errno=ENOENT;return -1;}
 if(latch_error){errno=EACCES;return -1;}
 if(latch){errno=EEXIST;return -1;}latch=1;return 5;
}
static int fstat(int fd,struct stat *s){s->st_mode=1;s->st_size=2;return 0;}
static int lstat(const char *path,struct stat *s){
 if(strstr(path,"package-request")){if(!latch){errno=ENOENT;return -1;}s->st_mode=1;s->st_size=0;return 0;}
 if(tick<appears){errno=ENOENT;return -1;}s->st_mode=1;s->st_size=tick>=finishes?101515264:1;return 0;
}
static ssize_t read(int fd,void *p,size_t size){
 if(fd==3){memcpy(p,"{}",2);return 2;}
 if(reply){const char *r="HTTP/1.1 200 OK\r\n\r\nSUCCESS: Direct install console Task started";size_t n=strlen(r);assert(size>=n);memcpy(p,r,n);reply=0;return n;}return 0;
}
static int exact_write(int fd,const void*p,size_t n){posts++;return 0;}
static int sysctlbyname(const char*n,void*out,size_t*len,void*in,size_t n2){*(uint32_t*)out=0x13600000;return 0;}
static int statfs(const char *path,struct statfs *s){s->f_bavail=2000000;s->f_bsize=4096;return 0;}
static json_t *json_create(char *s,json_t*p,size_t n){return p;}
static const json_t *json_getProperty(const json_t*p,const char*n){static json_t title={1},version={2};return !strcmp(n,"titleId")?&title:&version;}
static int json_getType(const json_t*p){return JSON_TEXT;}
static const char *json_getValue(const json_t*p){return p->field==1?"PPSA01650":wrong?"01.000.003":"01.000.030";}
static void progress(const char *message){}
static void sleep(unsigned seconds){assert(seconds==5);tick++;}
static int hash_file(const char*path,uint64_t*bytes,unsigned char *digest){
 const unsigned char expected[]={0xea,0xf0,0xba,0x5c,0x10,0x63,0x58,0x6c,0xcb,0xf7,0x6a,0x5b,0x7f,0xbd,0xfe,0xae,0xd4,0x59,0x91,0x17,0x64,0x60,0xba,0xad,0x87,0x22,0x2a,0xb6,0xbf,0x06,0xbb,0x80};
 *bytes=101515264;memcpy(digest,expected,32);if(corrupt)digest[0]^=1;return 0;
}
#include "../native/youtube-base.h"
static void reset(void){tick=posts=connects=latch=offline=corrupt=wrong=latch_error=0;appears=2;finishes=4;reply=1;}
int main(void){
 reset();assert(ensure_youtube_installed(1)==0);assert(posts==1&&tick==4);puts("PASS confirmed request waits for verified package");
 reset();reply=0;assert(ensure_youtube_installed(1)==0);assert(posts==1&&tick==4);puts("PASS lost DPI response still completes");
 reset();latch=1;offline=1;assert(ensure_youtube_installed(1)==0);assert(posts==0&&connects==0&&tick==4);puts("PASS prior request resumes with DPI offline and no duplicate");
 reset();offline=1;assert(ensure_youtube_installed(1)==0);assert(posts==0&&tick==4);puts("PASS late package completes after connection failure");
 reset();offline=1;appears=5;finishes=20;assert(ensure_youtube_installed(1)==0);assert(posts==0&&tick==20);puts("PASS observed installation extends connection-failure grace period");
 reset();offline=1;appears=finishes=1000;assert(ensure_youtube_installed(1)<0);assert(posts==0&&tick==12);puts("PASS unavailable DPI has bounded wait");
 reset();reply=0;corrupt=1;assert(ensure_youtube_installed(1)<0);assert(posts==1&&tick==90);puts("PASS a corrupt download is never accepted");
 reset();appears=finishes=1000;assert(ensure_youtube_installed(1)<0);assert(posts==1&&tick==90);puts("PASS accepted request without completed package times out");
 reset();latch_error=1;assert(ensure_youtube_installed(1)<0);assert(posts==0);puts("PASS failed request latch cannot send");
 reset();wrong=1;assert(ensure_youtube_installed(1)<0);assert(posts==0);puts("PASS wrong installed version is preserved");
 reset();assert(ensure_youtube_installed(0)<0);assert(posts==0);puts("PASS verification-only mode cannot install YouTube");
}
