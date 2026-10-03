// SPDX-License-Identifier: GPL-3.0-or-later
// Reuse the already validated Neighborhood service ABI for one test title.
#include <sys/param.h>
#include <sys/mount.h>
#include <sys/sysctl.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <fcntl.h>
#include "services.h"
int main(void) {
 service_resolve();
 int klog=open("/dev/klog",O_RDONLY|O_NONBLOCK);
 char buffer[4096];ssize_t n;size_t total=0;
 // Drain only a bounded existing backlog, then record the launch window.
 if(klog>=0)for(int i=0;i<64;i++){n=read(klog,buffer,sizeof buffer);if(n<=0)break;}
 int info[3]={0};int q=app_query("TEST10001",info);
 // An earlier crash is not a reason to repeatedly launch an already running app.
 int result=q?q:info[2]?-1023:app_action(1,"TEST10001");
 printf("SNIPERS_LAUNCH={\"title\":\"TEST10001\",\"exists\":%d,\"runningBefore\":%d,\"launchCode\":\"0x%08x\",\"klogOpen\":%d}\n",info[0],info[2],(uint32_t)result,klog>=0);fflush(stdout);
 for(int i=0;klog>=0&&i<100&&total<262144;i++){
  n=read(klog,buffer,sizeof buffer);if(n>0){fwrite(buffer,1,n,stdout);fflush(stdout);total+=n;}usleep(100000);
 }
 if(klog>=0)close(klog);
 return 0;
}
