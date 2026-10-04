// Native Linux filesystem regression; run only inside its temporary fixture.
#define EXPERIMENTAL_TRACE_ROOT "./logs"
#define EXPERIMENTAL_TRACE_PARENT "."
#include "experimental_trace.h"
#include <assert.h>
#include <stdlib.h>
int main(void){
 errno=E2BIG;experimental_event("test","RUN BEGIN",7,0);assert(errno==E2BIG);
 int fd=open("logs/trace.log",O_RDONLY);assert(fd>=0);char text[1024]={0};assert(read(fd,text,sizeof text-1)>0);close(fd);assert(strstr(text,"RUN BEGIN"));
 int lock=open("logs/.lock",O_WRONLY);assert(lock>=0);assert(flock(lock,LOCK_EX|LOCK_NB)==0);
 struct stat before,after;assert(stat("logs/trace.log",&before)==0);experimental_event("test","MUST NOT BLOCK",0,0);assert(stat("logs/trace.log",&after)==0&&before.st_size==after.st_size);close(lock);
 fd=open("logs/trace.log",O_WRONLY);assert(fd>=0);assert(ftruncate(fd,EXPERIMENTAL_TRACE_LIMIT)==0);close(fd);
 experimental_event("test","rotated",0,0);assert(stat("logs/trace.log.1",&after)==0&&after.st_size==EXPERIMENTAL_TRACE_LIMIT);assert(stat("logs/trace.log",&after)==0&&after.st_size<1024);
 assert(unlink("logs/trace.log")==0);fd=open("untouched",O_CREAT|O_WRONLY,0600);assert(fd>=0);assert(write(fd,"private",7)==7);close(fd);assert(symlink("../untouched","logs/trace.log")==0);experimental_event("test","reject symlink",0,0);assert(stat("untouched",&after)==0&&after.st_size==7);
 puts("trace persistence, errno, lock contention, rotation and symlink checks passed");return 0;
}
