// SPDX-License-Identifier: GPL-3.0-or-later
// Native PS5 payload: reads metadata/state only. No app launch or file writes.
#include <sys/param.h>
#include <sys/mount.h>
#include <sys/stat.h>
#include <sys/sysctl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <dlfcn.h>
#include "tiny-json.hpp"

static int finish(int code,const char *message){
#ifdef SNIPERS_INSTALLER
 progress(message);
#else
 printf("SNPR_OPTION_MESSAGE=%s\nSNPR_OPTION_RESULT=%d\n",message,code);fflush(stdout);
#endif
 return code;
}
static int youtube_preflight(void){
 setvbuf(stdout,NULL,_IONBF,0);
 printf("SNIPERS_YOUTUBE_PREFLIGHT=1\n");
 uint32_t firmware=0;size_t size=sizeof firmware;
 if(sysctlbyname("kern.sdk_version",&firmware,&size,NULL,0)||(firmware>>16)!=0x1360)
  return finish(-1,"This installer currently supports PS5 13.60 only.");
 const char *file="/system_data/priv/appmeta/PPSA01650/param.json";
 int fd=open(file,O_RDONLY|O_NOFOLLOW);if(fd<0)return finish(-2,"YouTube PPSA01650 metadata is unavailable.");
 struct stat st;char text[32768];
 if(fstat(fd,&st)||!S_ISREG(st.st_mode)||st.st_size<=0||st.st_size>=(off_t)sizeof text){close(fd);return finish(-3,"Unexpected YouTube metadata file.");}
 size_t done=0;while(done<(size_t)st.st_size){ssize_t n=read(fd,text+done,(size_t)st.st_size-done);if(n<=0){close(fd);return finish(-4,"YouTube metadata read failed.");}done+=(size_t)n;}
 close(fd);text[done]=0;
 json_t pool[256];const json_t *json=json_create(text,pool,256);
 if(!json)return finish(-5,"YouTube metadata could not be parsed.");
 const json_t *title=json_getProperty(json,"titleId"),*version=json_getProperty(json,"contentVersion");
 if(!title||!version||json_getType(title)!=JSON_TEXT||json_getType(version)!=JSON_TEXT||strcmp(json_getValue(title),"PPSA01650")||strcmp(json_getValue(version),"01.000.030"))
  return finish(-6,"Expected YouTube PPSA01650 version 01.000.030.");
 printf("YOUTUBE_VERSION=01.000.030\n");
 int (*get_app_id)(const char*)=dlsym(RTLD_DEFAULT,"sceLncUtilGetAppId");
 if(!get_app_id)return finish(-7,"YouTube running-state lookup is unavailable.");
 int app=get_app_id("PPSA01650");printf("YOUTUBE_APP_ID=%d\n",app);
 if(app<-1)return finish(-8,"YouTube running-state lookup failed.");
 struct statfs *mounts=NULL;int count=getmntinfo(&mounts,MNT_NOWAIT);if(count<=0||count>4096)return finish(-9,"Mount state could not be checked.");
 int mounted=0;for(int i=0;i<count;i++)if(strstr(mounts[i].f_mntfromname,"PPSA01650")||strstr(mounts[i].f_mntonname,"PPSA01650")){printf("YOUTUBE_MOUNT=%s\n",mounts[i].f_mntonname);mounted=1;}
 struct statfs space;if(statfs("/user/download",&space)||space.f_bsize<=0||space.f_bsize>1048576||space.f_bavail<0)return finish(-10,"Available storage could not be checked.");
 uint64_t free_bytes=(uint64_t)space.f_bavail*(uint64_t)space.f_bsize;printf("FREE_BYTES=%llu\n",(unsigned long long)free_bytes);
 int exists=!lstat("/user/download/PPSA01650/download0.dat",&st);
 if(exists&&!S_ISREG(st.st_mode))return finish(-11,"Existing YouTube image is not a regular file.");
 printf("EXISTING_IMAGE_BYTES=%lld\n",exists?(long long)st.st_size:0LL);
 if(app>=0||mounted)return finish(-12,"Read-only check complete. Close YouTube before installation. No files changed.");
 if(free_bytes<336789504ULL+64*1024*1024)return finish(-13,"Insufficient space for a staged startup image. No files changed.");
 return finish(0,"YouTube version, closed state and storage checks passed. No files changed.");
}
#ifndef SNIPERS_INSTALLER
int main(void){return youtube_preflight()<0?1:0;}
#endif
