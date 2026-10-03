// SPDX-License-Identifier: GPL-3.0-or-later
// Optional payload supervisor for this host's etaHEN 13.60 build.
// Uses John Tornblom's GPL elfldr, preserved in vendor/ with attribution.
#include "port_kstuff.hpp"
#include "port_startup_state.hpp"
#include <sys/sysctl.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <netinet/in.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <ctype.h>
extern "C" {
extern unsigned char child_start[];
pid_t elfldr_spawn(const char*,int,uint8_t*,const char*);
}
#ifdef OPTIONAL_SHADOWMOUNT
static const char* label="ShadowMountPlus";
static const char* needle="shadowmount";
static const char* child_name="shadowmountplus.elf";
static const char* latch="/system_tmp/snipers-shadowmount-attempted";
static const unsigned short port=10101;
#elif defined(OPTIONAL_NANODNS)
#include "nanodns-default.hpp"
static const char* label="NanoDNS";
static const char* needle="nanodns";
static const char* child_name="nanodns.elf";
static const char* latch="/system_tmp/snipers-nanodns-attempted";
static const unsigned short port=53;
#elif defined(OPTIONAL_FILEMANAGER)
static const char* label="Web File Manager";
static const char* needle="web-file-mgr";
static const char* child_name="web-file-mgr.elf";
static const char* latch="/system_tmp/snipers-filemanager-attempted";
static const unsigned short port=8888;
#elif defined(OPTIONAL_WEBSRV)
static const char* label="Homebrew web server";
static const char* needle="websrv";
static const char* child_name="websrv.elf";
static const char* latch="/system_tmp/snipers-websrv-attempted";
static const unsigned short port=8080;
#elif defined(OPTIONAL_FTP)
static const char* label="ftpsrv";
static const char* needle="ftpsrv";
static const char* child_name="ftpsrv.elf";
static const char* latch="/system_tmp/snipers-ftp-attempted";
static const unsigned short port=2121;
#elif defined(OPTIONAL_PAYLOADMANAGER)
static const char* label="Payload Manager";
static const char* needle="pldmgr";
static const char* child_name="pldmgr.elf";
static const char* latch="/system_tmp/snipers-payloadmanager-attempted";
static const unsigned short port=8084;
#elif defined(OPTIONAL_DEBUG)
static const char* label="PS5Debug-NG";
static const char* needle="ps5debug";
static const char* child_name="PS5Debug-NG";
static const char* latch="/system_tmp/snipers-debug-attempted";
static const unsigned short port=744;
#else
#error Select a known optional payload
#endif
static void progress(const char* text){printf("SNPR_OPTION_PROGRESS=%s\n",text);fflush(stdout);}
static int finish(int code,const char* text){
 printf("SNPR_OPTION_MESSAGE=%s: %s\nSNPR_OPTION_RESULT=%d\n",label,text,code);fflush(stdout);
 return code<0?1:0;
}
// Fail closed on unknown process layouts or enumeration errors. Exclude self:
// the loader can name this supervisor after its payload filename.
static int find_process(const char* name){
 int mib[]={CTL_KERN,KERN_PROC,KERN_PROC_PROC,0};size_t size=0;
 if(sysctl(mib,4,nullptr,&size,nullptr,0)||!size||size>16*1024*1024)return -1;
 size+=size/4;auto* data=(unsigned char*)malloc(size);if(!data)return -1;
 if(sysctl(mib,4,data,&size,nullptr,0)){free(data);return -1;}
 int found=0;size_t offset=0;
 while(offset<size){
  int length=0,pid=0;if(size-offset<4){found=-1;break;}
  memcpy(&length,data+offset,4);
  if(length<480||(size_t)length>size-offset){found=-1;break;}
  memcpy(&pid,data+offset+72,4);
  char thread[33]={0};memcpy(thread,data+offset+447,32);
  for(auto& c:thread)c=(char)tolower((unsigned char)c);
  if(pid!=getpid()&&strstr(thread,name)){found=pid;break;}
  offset+=(size_t)length;
 }
 free(data);return found;
}
// Bind-only check: never open an empty connection to a debugger/ELF loader.
static int occupied(unsigned short value){
 int fd=socket(AF_INET,
#ifdef OPTIONAL_NANODNS
 SOCK_DGRAM,
#else
 SOCK_STREAM,
#endif
 0);if(fd<0)return -1;
 sockaddr_in addr{};addr.sin_len=sizeof(addr);addr.sin_family=AF_INET;
 addr.sin_port=htons(value);addr.sin_addr.s_addr=htonl(INADDR_ANY);
 int rc=bind(fd,(sockaddr*)&addr,sizeof(addr)),error=errno;close(fd);
 return rc==0?0:error==EADDRINUSE?1:-1;
}
#ifdef OPTIONAL_NANODNS
static bool prepare_dns_config(){
 if(mkdir("/data/nanodns",0755)&&errno!=EEXIST)return false;
 int fd=open("/data/nanodns/nanodns.ini",O_WRONLY|O_CREAT|O_EXCL,0644);
 if(fd<0)return errno==EEXIST; // Preserve existing user configuration exactly.
 size_t done=0,total=strlen(nanodns_default);
 while(done<total){ssize_t n=write(fd,nanodns_default+done,total-done);if(n<=0){close(fd);return false;}done+=(size_t)n;}
 bool ok=fsync(fd)==0;close(fd);return ok;
}
static bool dns_ready(){
 // Complete, read-only DNS query to loopback; not a console DNS-setting change.
 const unsigned char q[]={0x53,0x4e,1,0,0,1,0,0,0,0,0,0,7,'m','a','n','u','a','l','s',11,'p','l','a','y','s','t','a','t','i','o','n',3,'n','e','t',0,0,1,0,1};
 int fd=socket(AF_INET,SOCK_DGRAM,0);if(fd<0)return false;
 timeval timeout{2,0};setsockopt(fd,SOL_SOCKET,SO_RCVTIMEO,&timeout,sizeof(timeout));
 sockaddr_in addr{};addr.sin_len=sizeof(addr);addr.sin_family=AF_INET;addr.sin_port=htons(53);addr.sin_addr.s_addr=htonl(0x7f000001);
 unsigned char answer[4096];ssize_t n=-1;
 if(connect(fd,(sockaddr*)&addr,sizeof(addr))==0&&send(fd,q,sizeof(q),0)==sizeof(q))n=recv(fd,answer,sizeof(answer),0);
 close(fd);return n>=12&&answer[0]==q[0]&&answer[1]==q[1]&&(answer[2]&0x80);
}
#endif
static bool debugger_ready(){
 int fd=socket(AF_INET,SOCK_STREAM,0);if(fd<0)return false;
 timeval timeout{2,0};setsockopt(fd,SOL_SOCKET,SO_RCVTIMEO,&timeout,sizeof(timeout));setsockopt(fd,SOL_SOCKET,SO_SNDTIMEO,&timeout,sizeof(timeout));
 sockaddr_in addr{};addr.sin_len=sizeof(addr);addr.sin_family=AF_INET;addr.sin_port=htons(744);addr.sin_addr.s_addr=htonl(0x7f000001);
 uint32_t query[]={0xffaabbcc,0xbd000502,0};uint16_t platform=0;bool ok=false;
 if(connect(fd,(sockaddr*)&addr,sizeof(addr))==0){
  size_t sent=0;while(sent<sizeof(query)){ssize_t n=send(fd,(char*)query+sent,sizeof(query)-sent,0x20000);if(n<=0)break;sent+=(size_t)n;}
  if(sent==sizeof(query)){size_t got=0;while(got<sizeof(platform)){ssize_t n=recv(fd,(char*)&platform+got,sizeof(platform)-got,0);if(n<=0)break;got+=(size_t)n;}ok=got==sizeof(platform)&&platform==5;}
 }
 close(fd);return ok;
}
static bool kstuff_probe(){
 // Same read-only KEKCALL_CHECK used by upstream ShadowMountPlus.
 register uint64_t r10 __asm__("r10")=0,r8 __asm__("r8")=0,r9 __asm__("r9")=0;
 uint64_t result;unsigned char error;
 __asm__ __volatile__("syscall":"=a"(result),"=@ccc"(error),"+r"(r10),"+r"(r8),"+r"(r9):"a"(UINT64_C(0xffffffff00000027)),"D"(UINT64_C(0)),"S"(UINT64_C(0)),"d"(UINT64_C(0)):"rcx","r11","memory");
 return !error&&result==0;
}
static int eta_ready(){
 static bool diagnosed=false;
 static int previousShellui=-2;
 const int liveShellui=find_process("sceshellui");
 if(liveShellui!=previousShellui){
  printf("SNPR_OPTION_PROGRESS=ShellUI PID %d -> %d during etaHEN readiness\n",previousShellui,liveShellui);fflush(stdout);
  previousShellui=liveShellui;
 }
 const int critical=find_process("etahen critical");
 if(critical<=0){if(!diagnosed){printf("SNPR_OPTION_PROGRESS=etaHEN process lookup: %d\n",critical);fflush(stdout);diagnosed=true;}return false;}
 FILE* f=fopen(PORT_STARTUP_PATH,"rb");if(!f)return 0;
 PortStartupRecord record;const bool valid=port_read_startup(f,record);fclose(f);
 if(!valid)return 0;
 const int ready=record.evaluate(critical,liveShellui);
 if(ready<0){
  printf("SNPR_OPTION_PROGRESS=Startup failure detail: status=%u critical=%d recorded-ShellUI=%d live-ShellUI=%d\n",(unsigned)record.status,record.critical,record.shellui,liveShellui);fflush(stdout);
  if(record.status==PortStartupStatus::Failed)progress("etaHEN reported Toolbox initialization failure");
  if(record.shellui>0&&liveShellui>0&&record.shellui!=liveShellui)progress("ShellUI PID changed since the startup record");
 }
 if(ready!=1)return ready;
 const auto s=port_read_kstuff_state();
 if(!diagnosed){printf("SNPR_OPTION_PROGRESS=kstuff state=%d readable=%d active=%04x/%04x\n",(int)s.classify(KERNEL_ADDRESS_DATA_BASE),s.readable,(unsigned)(s.native>>48),(unsigned)(s.compat>>48));fflush(stdout);diagnosed=true;}
 return s.classify(KERNEL_ADDRESS_DATA_BASE)==PortKstuffState::Installed&&s.injectionReady(KERNEL_ADDRESS_DATA_BASE)&&kstuff_probe();
}
#ifdef OPTIONAL_PAYLOADMANAGER
static bool prepare_manager_config(){
 const char* path="/data/pldmgr/pldmgr_config.txt";
 if(mkdir("/data/pldmgr",0755)&&errno!=EEXIST)return false;
 int fd=open(path,O_WRONLY|O_CREAT|O_EXCL,0644);
 if(fd>=0){
  const char config[]="AUTOLOAD_ENABLED=0\nAUTO_BROWSER_OPEN=0\nKILL_DISC_PLAYER_ON_STARTUP=0\nAUTO_INSTALL_APP=1\n";
  size_t done=0;while(done<sizeof(config)-1){ssize_t n=write(fd,config+done,sizeof(config)-1-done);if(n<=0){close(fd);unlink(path);return false;}done+=(size_t)n;}
  const bool ok=fsync(fd)==0;close(fd);return ok;
 }
 if(errno!=EEXIST)return false;
 // Keep existing settings; refuse a competing autoload or browser sequence.
 FILE* f=fopen(path,"r");if(!f)return false;
 char line[256];int autoload=0,browser=1,disc=1;
 while(fgets(line,sizeof(line),f)){
  if(!strncmp(line,"AUTOLOAD_ENABLED=",17))autoload=atoi(line+17);
  if(!strncmp(line,"AUTO_BROWSER_OPEN=",18))browser=atoi(line+18);
  if(!strncmp(line,"KILL_DISC_PLAYER_ON_STARTUP=",28))disc=atoi(line+28);
 }
 const bool ok=!ferror(f)&&!autoload&&!browser&&!disc;fclose(f);return ok;
}
#endif
int main(){
 uint32_t fw=0;size_t size=sizeof(fw);
 if(sysctlbyname("kern.sdk_version",&fw,&size,nullptr,0)||(fw>>16)!=0x1360)
  return finish(-1,"requires PS5 13.60; nothing loaded");
 int existing=find_process(needle),busy=occupied(port);
 if(existing<0||busy<0)return finish(-3,"could not check existing services; nothing loaded");
 if(existing>0)return finish(1,"already running; not loaded again");
#ifdef OPTIONAL_DEBUG
 if(busy&&debugger_ready())return finish(1,"already running; not loaded again");
#endif
 if(busy)return finish(-4,"service port is occupied; nothing loaded");
#ifdef OPTIONAL_PAYLOADMANAGER
 if(!prepare_manager_config())return finish(-13,"existing settings preserved; turn off Payload Manager autoload, automatic browser opening and Disc Player closing before using this host option");
#endif
 for(int i=0;;++i){
  const int ready=eta_ready();
  if(ready<0)return finish(-12,"etaHEN Toolbox startup failed or ShellUI restarted; no optional payload loaded; restart before retrying");
  if(ready==1)break;
  if(i>=60)return finish(-2,"etaHEN and active kstuff were not ready; nothing loaded");
  progress("Waiting for etaHEN and kstuff to finish startup");sleep(1);
 }
 existing=find_process(needle);busy=occupied(port);
 if(existing<0||busy<0)return finish(-3,"could not check existing services; nothing loaded");
 if(existing>0)return finish(1,"already running; not loaded again");
 if(busy)return finish(-4,"service port is occupied; nothing loaded");
#ifdef OPTIONAL_SHADOWMOUNT
 const int conflict=find_process("backpork");
 if(conflict!=0)return finish(-5,"BackPork is present or cannot be excluded; restart without BackPork");
#endif
#ifdef OPTIONAL_NANODNS
 if(!prepare_dns_config())return finish(-11,"cannot prepare DNS config; nothing loaded");
#endif
 int fd=open(latch,O_WRONLY|O_CREAT|O_EXCL,0600);
 if(fd<0)return finish(-6,"already attempted this boot or guard unavailable; restart before retrying");
 close(fd); // Keep this boot-local latch even if launch fails after partial hooks.
 progress("Starting the selected payload once");
 int quiet=open("/dev/null",O_RDWR);if(quiet<0)return finish(-7,"could not prepare child output");
 pid_t child=elfldr_spawn("/",quiet,child_start,child_name);close(quiet);
 if(child<=0)return finish(-8,"launch failed; restart before retrying");
 for(int i=0;i<60;++i){
  existing=find_process(needle);busy=occupied(port);
#ifdef OPTIONAL_DEBUG
  // PS5Debug's installer exits after moving its server into SceShellCore.
  if(busy==1&&debugger_ready())return finish(0,"debugger protocol identifies PS5 and is ready");
#elif defined(OPTIONAL_NANODNS)
  if(existing==child&&busy==1&&dns_ready())return finish(0,"local DNS proxy answers queries; PS5 DNS settings were preserved");
#else
  if(existing==child&&busy==1)return finish(0,"process and service port are ready");
#endif
  if(existing<0||busy<0)return finish(-9,"launched but status could not be checked; do not reload");
  progress("Waiting for the selected service to become ready");sleep(1);
 }
 return finish(-10,"sent but readiness was not confirmed (custom port/API settings may differ); do not reload");
}
