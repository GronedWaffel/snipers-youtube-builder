#include "port_firmware.h"
#ifndef SNIPERS_TARGET_FW
#error Expected a pinned target firmware
#endif
// SPDX-License-Identifier: GPL-3.0-or-later
// Experimental post-Relapse lifetime test. No etaHEN or optional payload launch.
#include <sys/param.h>
#include <sys/mount.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/sysctl.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <signal.h>
#include <time.h>
#include <dlfcn.h>
void notify(const char *format,...);
#ifdef SNIPERS_BUNDLED_STARTUP
#define HANDOFF_LATCH "/system_tmp/snipers-handoff-startup-attempted"
#define HANDOFF_LOG "/data/snipers-youtube-handoff-startup.log"
#define DASHBOARD_SETTLE_SECONDS 5
#else
#define HANDOFF_LATCH "/system_tmp/snipers-handoff-probe-attempted"
#define HANDOFF_LOG "/data/snipers-youtube-handoff-probe.log"
#define DASHBOARD_SETTLE_SECONDS 10
#endif

static int logfile=-1,udp=-1;
static struct sockaddr_in peer;
static int record(const char *text,int value){
 char line[1536];int n=snprintf(line,sizeof line,"handoff time=%lld pid=%d ppid=%d %s=%d\n",(long long)time(NULL),getpid(),getppid(),text,value);
 if(n<=0||n>=(int)sizeof line)return -1;
 if(udp>=0)sendto(udp,line,n,MSG_DONTWAIT, (struct sockaddr*)&peer,sizeof peer);
 int offset=0;while(offset<n){ssize_t wrote=write(logfile,line+offset,n-offset);if(wrote<=0)return -1;offset+=wrote;}
 return fsync(logfile);
}
static int stop(int code,const char *message){record(message,code);notify("%s",message);return code?1:0;}
#ifdef SNIPERS_BUNDLED_STARTUP
#include "handoff-payloads.h"
#endif
int main(void){
 setvbuf(stdout,NULL,_IONBF,0);signal(SIGPIPE,SIG_IGN);
 uint32_t fw=0;size_t len=sizeof fw;
 if(sysctlbyname("kern.sdk_version",&fw,&len,0,0)||(fw&0xffff0000u)!=SNIPERS_TARGET_FW||!snipers_firmware_profile(fw))return 1;
 // Exactly one attempt this boot, including failures. No automatic close retry.
 int latch=open(HANDOFF_LATCH,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0600);
 if(latch<0)return 1;close(latch);
 logfile=open(HANDOFF_LOG,O_WRONLY|O_CREAT|O_APPEND|O_NOFOLLOW,0600);
 if(logfile<0)return 1;
 struct stat st;if(fstat(logfile,&st)||!S_ISREG(st.st_mode)||st.st_size>1024*1024)return 1;
 // Private test logging only; public builds never send console data to a PC.
#ifdef SNIPERS_HANDOFF_LOG_IP
 udp=socket(AF_INET,SOCK_DGRAM,0);memset(&peer,0,sizeof peer);peer.sin_len=sizeof peer;peer.sin_family=AF_INET;peer.sin_port=htons(5051);inet_pton(AF_INET,SNIPERS_HANDOFF_LOG_IP,&peer.sin_addr);
#endif
 int (*get_app)(const char*)=dlsym(RTLD_DEFAULT,"sceLncUtilGetAppId");
 int (*close_app)(int,int,int,int)=dlsym(RTLD_DEFAULT,"sceSystemServiceKillApp");
 if(!get_app||!close_app)return stop(1,"YouTube close API unavailable; nothing closed");
 int app=get_app("PPSA01650");if(record("ready app",app))return 1;
 if(app<0)return stop(2,"YouTube is not running; handoff test not performed");
#ifdef SNIPERS_BUNDLED_STARTUP
 if(bundle_has_etahen&&access("/system_tmp/etahen-experimental-startup",F_OK)==0)return stop(9,"etaHEN was already attempted this boot; reboot before startup");
 if(verify_embedded_payloads())return stop(10,"Bundled payload integrity failed; YouTube left open");
 puts("SNPR_OPTION_MESSAGE=Independent startup owns and verified all bundled payloads.\nSNPR_OPTION_RESULT=0");
#else
 // All code/data live in this ELF. No file handles into the YouTube mount.
 puts("SNPR_OPTION_MESSAGE=Independent probe accepted; YouTube close test follows.\nSNPR_OPTION_RESULT=0");
#endif
 fflush(stdout);
 // Drop the loader's console socket: a closed YouTube connection must not
 // terminate this process or keep us dependent on its JS response reader.
 int quiet=open("/dev/null",O_RDWR);if(quiet<0)return stop(3,"Could not detach probe output; nothing closed");
 for(int i=0;i<3;i++)if(dup2(quiet,i)<0)return stop(3,"Could not detach probe output; nothing closed");
 if(quiet>2)close(quiet);
 sleep(3);
 if(get_app("PPSA01650")!=app)return stop(4,"YouTube state changed; close cancelled");
 if(record("before close",app))return 1;
 int result=close_app(app,-1,0,0);if(record("close returned",result))return 1;
 if(result)return stop(5,"YouTube close failed; no payloads launched");
 int closed=0;
 for(int i=0;i<150;i++){
  int now=get_app("PPSA01650");if(now==-1){closed=1;break;}
  if(now!=app)return stop(6,"YouTube lookup changed unexpectedly; test stopped");
  usleep(100000);
 }
 if(!closed)return stop(7,"YouTube did not close in time; no retry");
 if(record("YouTube closed; independent process alive",1))return 1;
 for(int i=1;i<=DASHBOARD_SETTLE_SECONDS;i++){sleep(1);if(get_app("PPSA01650")!=-1)return stop(8,"YouTube reopened; test stopped");if(record("survived seconds",i))return 1;}
#ifdef SNIPERS_BUNDLED_STARTUP
 struct statfs *mounts=NULL;int count=getmntinfo(&mounts,MNT_NOWAIT);
 if(count<=0||count>4096)return stop(11,"Cannot confirm YouTube unmounted; payload startup stopped");
 for(int i=0;i<count;i++)if(strstr(mounts[i].f_mntonname,"PPSA01650")||strstr(mounts[i].f_mntfromname,"PPSA01650"))return stop(12,"YouTube mount remains; payload startup stopped");
 notify("YouTube closed. Starting selected payloads.");
 if(run_embedded_payloads())return stop(13,"Startup stopped; a payload did not confirm readiness. Reboot before retrying.");
 return stop(0,bundle_completion);
#else
 return stop(0,"Handoff test passed: YouTube closed. No etaHEN loaded yet.");
#endif
}
