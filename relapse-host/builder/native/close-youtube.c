// SPDX-License-Identifier: GPL-3.0-or-later
// User-requested close of YouTube only. No other app action is exposed.
#include <sys/param.h>
#include <sys/mount.h>
#include <sys/sysctl.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include "services.h"
int main(void){
 setvbuf(stdout,NULL,_IONBF,0);service_resolve();
 uint32_t fw=0;size_t n=sizeof fw;if(sysctlbyname("kern.sdk_version",&fw,&n,0,0)||(fw>>16)!=0x1360)return 1;
 int info[3]={0};int r=app_query("PPSA01650",info);if(r){printf("YouTube lookup failed: %d\n",r);return 1;}
 if(!info[2]){puts("YouTube is already closed.");return 0;}
 r=app_action(2,"PPSA01650");printf("YouTube close result: 0x%08x\n",(uint32_t)r);return r?1:0;
}
