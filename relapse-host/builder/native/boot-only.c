// SPDX-License-Identifier: MIT
// Isolates ordinary application startup. No sockets, FTP, file writes or setup.
#include <orbis/libkernel.h>
int main(void) {
 OrbisNotificationRequest request={0};request.type=NotificationRequest;request.targetId=-1;
 const char message[]="Snipers Setup: minimal boot reached main. No files changed.";
 for(unsigned i=0;i<sizeof(message);i++)request.message[i]=message[i];
 sceKernelSendNotificationRequest(0,&request,sizeof(request),0);
 for(;;)sceKernelUsleep(1000000);
}
