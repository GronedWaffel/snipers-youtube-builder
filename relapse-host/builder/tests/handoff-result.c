#include <assert.h>
#include <string.h>
#include "../native/handoff-result.h"
int main(void){
 assert(handoff_result("SNPR_OPTION_RESULT=0")==1);
 assert(handoff_result("SNPR_OPTION_RESULT=1")==1);
 assert(handoff_result("SNPR_OPTION_RESULT=-12")==-1);
 assert(handoff_result("SNPR_OPTION_RESULT=2")==-1);
 assert(handoff_result("SNPR_OPTION_RESULT=0garbage")==-1);
 assert(handoff_result("SNPR_OPTION_RESULT=")==-1);
 assert(handoff_result("SNPR_OPTION_RESULT=00")==-1);
 assert(handoff_result("SNPR_OPTION_MESSAGE=SNPR_OPTION_RESULT=0")==0);
 assert(handoff_result("Waiting for etaHEN")==0);
 return 0;
}
