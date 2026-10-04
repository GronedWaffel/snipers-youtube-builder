#include <assert.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
static char saved_text[4096],notice[1024],browser_text[4096];
static int log_fd=-1,notices=0,disconnected=0;
static time_t clock_value=100;
static void saved(const char *s){strcat(saved_text,s);}
void notify(const char *format,...){va_list args;va_start(args,format);vsnprintf(notice,sizeof notice,format,args);va_end(args);notices++;}
static int stream_puts(const char*s,FILE*f){(void)f;if(disconnected)return EOF;strcat(browser_text,s);return 0;}
static int stream_flush(FILE*f){(void)f;return disconnected?EOF:0;}
static int close_log(int fd){(void)fd;return 0;}
static time_t test_time(time_t*t){(void)t;return clock_value;}
#define fputs stream_puts
#define fflush stream_flush
#define fsync close_log
#define close close_log
#define time test_time
#include "../native/installer-status.h"
int main(void){
 progress("Installer started");assert(notices==1);assert(strstr(browser_text,"SNPR_OPTION_PROGRESS=Installer started"));
 progress("Checking YouTube");assert(notices==1);assert(!strcmp(last_progress,"Checking YouTube"));
 clock_value+=15;progress("Downloading");assert(notices==2);
 disconnected=1;progress("YouTube must be closed");assert(!strcmp(last_progress,"YouTube must be closed"));
 assert(result(-21,last_progress)==1);assert(notices==3);assert(strstr(notice,"YouTube must be closed"));assert(strstr(saved_text,"SNPR_OPTION_RESULT=-21"));
 assert(result(0,"Installed and verified")==0);assert(notices==4);assert(strstr(notice,"Installed and verified"));
 puts("PASS manual notifications and saved results survive a disconnected sender; browser protocol retained");
}
