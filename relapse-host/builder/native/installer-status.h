// SPDX-License-Identifier: GPL-3.0-or-later
// Preserve browser output while making manual launches visible on the console.
static char last_progress[384];
static time_t last_notice;
void notify(const char *format,...);
static void progress(const char *message){
 char line[512];snprintf(last_progress,sizeof last_progress,"%s",message);
 snprintf(line,sizeof line,"SNPR_OPTION_PROGRESS=%s\n",message);saved(line);
 time_t now=time(NULL);
 if(!last_notice||now-last_notice>=15){notify("Snipers YouTube: %s",message);last_notice=now;}
 fputs(line,stdout);fflush(stdout);
}
static int result(int code,const char *message){
 char line[640];snprintf(line,sizeof line,"SNPR_OPTION_MESSAGE=%s\nSNPR_OPTION_RESULT=%d\n",message,code);saved(line);
 notify("Snipers YouTube: %s",message);
 if(log_fd>=0){fsync(log_fd);close(log_fd);log_fd=-1;}
 fputs(line,stdout);fflush(stdout);return code<0?1:0;
}
