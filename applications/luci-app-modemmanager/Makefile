#
# Copyright (C) 2024 TDT AG <development@tdt.de>
#
# This is free software, licensed under the Apache License Version 2.0.
# See https://www.apache.org/licenses/LICENSE-2.0 for more information.
#

include $(TOPDIR)/rules.mk

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Florian Eckert <feckert@tdt.de>

LUCI_TITLE:=Support for modemmanager
LUCI_DEPENDS:=+modemmanager +mm-ubus +modemmanager-rpcd
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
