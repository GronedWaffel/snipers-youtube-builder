// SPDX-License-Identifier: GPL-3.0-or-later
// Preserve user configuration while the host owns the startup sequence.
#pragma once
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <sys/stat.h>
#include <time.h>

static const size_t manager_config_limit=65536;
static const char manager_startup_settings[]=
 "AUTOLOAD_ENABLED=0\nAUTO_BROWSER_OPEN=0\nKILL_DISC_PLAYER_ON_STARTUP=0\n";

static bool manager_normalize(const char* input,size_t size,char* output,size_t* output_size){
 if(size>manager_config_limit||memchr(input,0,size))return false;
 size_t used=0;
 for(size_t start=0;start<size;){
  size_t end=start;while(end<size&&input[end]!='\n')++end;
  // Upstream reads 256-byte lines; reject ambiguous/truncated settings.
  if(end-start>254)return false;
  const char* keys[]={"AUTOLOAD_ENABLED=","AUTO_BROWSER_OPEN=","KILL_DISC_PLAYER_ON_STARTUP="};
  bool setting=false;
  for(const char* key:keys)if(end-start>=strlen(key)&&!memcmp(input+start,key,strlen(key)))setting=true;
  if(end<size)++end;
  if(!setting){memcpy(output+used,input+start,end-start);used+=end-start;}
  start=end;
 }
 if(used&&output[used-1]!='\n')output[used++]='\n';
 memcpy(output+used,manager_startup_settings,sizeof(manager_startup_settings)-1);
 *output_size=used+sizeof(manager_startup_settings)-1;return *output_size<=manager_config_limit;
}

static bool manager_write_new(const char* path,const char* bytes,size_t size){
 int fd=open(path,O_WRONLY|O_CREAT|O_EXCL,0600);if(fd<0)return false;
 size_t done=0;bool ok=true;
 while(done<size){ssize_t n=write(fd,bytes+done,size-done);if(n<0&&errno==EINTR)continue;if(n<=0){ok=false;break;}done+=(size_t)n;}
 if(ok&&fsync(fd))ok=false;
 if(close(fd))ok=false;
 if(!ok)unlink(path);
 return ok;
}

// 0: already normalized, 1: created/adapted, -1: original left in place.
// backup_path receives the unique, durable pre-change copy when one was needed.
static int manager_prepare(const char* path,char* backup_path,size_t backup_capacity){
 backup_path[0]=0;
 char* original=(char*)malloc(manager_config_limit+1);
 char* updated=(char*)malloc(manager_config_limit+sizeof(manager_startup_settings)+32);
 if(!original||!updated){free(original);free(updated);return -1;}
 size_t size=0,updated_size=0;bool exists=false,ok=true;
 FILE* f=fopen(path,"rb");
 if(f){exists=true;size=fread(original,1,manager_config_limit+1,f);ok=!ferror(f)&&size<=manager_config_limit;fclose(f);}
 else if(errno!=ENOENT)ok=false;
 if(ok)ok=manager_normalize(original,size,updated,&updated_size);
 if(ok&&exists&&size==updated_size&&!memcmp(original,updated,size)){free(original);free(updated);return 0;}
 char temp[512];
 const long long now=(long long)time(nullptr);const int pid=(int)getpid();
 int length=snprintf(temp,sizeof(temp),"%s.snipers-tmp-%lld-%d",path,now,pid);
 if(length<0||(size_t)length>=sizeof(temp))ok=false;
 if(ok&&exists){
  length=snprintf(backup_path,backup_capacity,"%s.snipers-backup-%lld-%d",path,now,pid);
  if(length<0||(size_t)length>=backup_capacity)ok=false;
  if(ok)ok=manager_write_new(backup_path,original,size);
 }
 if(ok){
  ok=manager_write_new(temp,updated,updated_size);
  if(ok){if(rename(temp,path)){unlink(temp);ok=false;}}
 }
 free(original);free(updated);return ok?1:-1;
}
