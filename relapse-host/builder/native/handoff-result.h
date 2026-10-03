// SPDX-License-Identifier: MIT
// 0 = not a result line, 1 = success, -1 = malformed or failure result.
static int handoff_result(const char *line){
 const char *prefix="SNPR_OPTION_RESULT=";size_t length=strlen(prefix);
 if(strncmp(line,prefix,length))return 0;
 const char *value=line+length;
 return (!strcmp(value,"0")||!strcmp(value,"1"))?1:-1;
}
