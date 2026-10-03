/* SPDX-License-Identifier: GPL-3.0-or-later
 * Snipers 13.60 integration: retain drakmor's mounting and KEKCALL services,
 * but never apply the legacy pointer-poisoning controller to kstuff-lite.
 */
#ifndef SM_KSTUFF_COMPAT_H
#define SM_KSTUFF_COMPAT_H
#include <stdbool.h>
#include <stdint.h>
static inline bool sm_kstuff_legacy_control_allowed(uint32_t firmware) {
  return (firmware & UINT32_C(0xffff0000)) != UINT32_C(0x13600000);
}
#endif
