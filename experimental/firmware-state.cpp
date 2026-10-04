#include "../etahen-13.60/Source Code/include/port_firmware.h"
#include "../etahen-13.60/Source Code/include/port_kstuff_state.hpp"
#include "../etahen-13.60/Source Code/shellui/include/port_boot_abi.hpp"
#include <assert.h>
#include <stdio.h>
int main(){
 assert(port_boot_abi(2,false,"System.Boolean","System.String","System.Int32",nullptr)==PortBootAbi::TwoArguments);
 assert(port_boot_abi(3,false,"System.Boolean","System.String","System.Int32","System.String")==PortBootAbi::StringArgument);
 assert(port_boot_abi(3,false,"System.Boolean","System.String","System.Int32","System.Nullable<System.Int64>",16,8)==PortBootAbi::NullableInt64);
 assert(port_boot_abi(3,false,"System.Boolean","System.String","System.Int32","System.Nullable<System.Int32>",8,4)==PortBootAbi::Unsupported);
 assert(port_boot_abi(3,false,"System.Boolean","System.String","System.Int32","System.Nullable<System.Int64>",8,4)==PortBootAbi::Unsupported);
 assert(port_boot_abi(2,true,"System.Boolean","System.String","System.Int32",nullptr)==PortBootAbi::Unsupported);
 assert(port_boot_abi(2,false,"System.Void","System.String","System.Int32",nullptr)==PortBootAbi::Unsupported);
 const uint64_t base=UINT64_C(0xffffffff80000000);
 assert(!snipers_firmware_profile(0x9050000));assert(!snipers_firmware_profile(0x11400000));
 assert(!snipers_firmware_profile(0));assert(!snipers_firmware_profile(0x14000000));
 for(const auto& p:snipers_firmware_profiles){
  assert(snipers_firmware_profile(p.code|7)==&p);
  PortKstuffSnapshot s;
  s.expectedNative=base+p.sysents;s.expectedCompat=base+p.sysentsPs4;
  s.native=s.expectedNative;s.compat=s.expectedCompat;s.xts=s.hmac=0xffff;s.readable=true;
  assert(s.classify(base)==PortKstuffState::Unmodified);assert(s.injectionReady(base));
  s.native=base+0x777000;s.compat=base+0x888000;s.xts=s.hmac=0xdeb7;
  assert(s.classify(base)==PortKstuffState::Installed);assert(s.injectionReady(base));
  s.native=(s.native&UINT64_C(0xffffffffffff))|UINT64_C(0xdeb7000000000000);
  assert(s.classify(base)==PortKstuffState::Installed);assert(!s.injectionReady(base));
  s.hmac=0xffff;assert(s.classify(base)==PortKstuffState::Unknown);
  s.readable=false;assert(s.classify(base)==PortKstuffState::Unknown);
  s.readable=true;s.expectedNative=0;assert(s.classify(base)==PortKstuffState::Unknown);
 }
 puts("33 firmware state profiles passed, unsupported versions rejected");
}
