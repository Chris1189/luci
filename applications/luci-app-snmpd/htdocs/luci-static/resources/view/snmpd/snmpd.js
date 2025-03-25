// SPDX: Apache-2.0
// Karl Palsson <karlp@etactica.com> 2021
"use strict";
"require form";
"require uci";
"require fs";
"require rpc";
"require ui";
"require view";

return L.view.extend({
	load: function() {
		return Promise.all([
			uci.load("snmpd"),
		]);
	},

	__init__: function() {
		this.super("__init__", arguments);

		this.ro_community = null;
		this.ro_community_src = null;
		this.rw_community = null;
		this.rw_community_src = null;
		this.oid = null;
		this.ip_protocol = null;
		this.snmp_version = null;
	},

	populateSystemSettings: function(tab, s, data) {
		var g, go, o;

		o = s.taboption("general", form.SectionValue, "__general__",
			form.TypedSection, "system", null,
			_("Here you can configure system settings"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = false;

		go = g.option(form.Value, "sysLocation", "sysLocation");
		go = g.option(form.Value, "sysContact", "sysContact");
		go = g.option(form.Value, "sysName", "sysName");
	},
	
	populateGlobalSettings: function(tab, s, data) {
		var go, g, o;

		o = s.taboption("general", form.SectionValue, "__general__",
			form.TypedSection, "snmpd", null,
			_("Here you can configure agent settings"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = false;

		go = g.option(form.Flag, "enabled", _("Enable SNMP"),
			_("Enable to use SNMP"));
		go.default = "0";
		go.rmempty = false;

		this.ip_protocol = g.option(form.ListValue, 'ip_protocol', _('IP version'));
		this.ip_protocol.value('ipv4', _('Only IPv4'));
		this.ip_protocol.value('ipv6', _('Only IPv6'));
		this.ip_protocol.value('ipv4/ipv6', _('IPv4 and IPv6'));
		this.ip_protocol.optional = false;
		this.ip_protocol.forcewrite = true;
		this.ip_protocol.default = "ipv4";
		this.ip_protocol.rmempty = false;

		this.ip_protocol.cfgvalue = function(section_id) {
			var ip_protocol = uci.get('snmpd', section_id, 'ip_protocol');

			if (!ip_protocol) {
				var s = uci.get_first('snmpd', 'agent');
				if (!s)
					return null;

				var addr = uci.get('snmpd', s['.name'], 'agentaddress');
				var p = [];

				if (!addr)
					return null;

				addr = addr.toUpperCase();

				if (addr.match(/UDP:\d+/g))
					p.push('ipv4');

				if (addr.match(/UDP6:\d+/g))
					p.push('ipv6');

				ip_protocol = p.join('/');
			}

			return ip_protocol;
		};

		go = g.option(form.Value, "snmp_port", _("Port"));
		go.rmempty = false;
		go.default = '161';
		go.datatype = 'port';
		go.forcewrite = true;
		go.cfgvalue = function(section_id) {
			var port = uci.get('snmpd', section_id, 'snmp_port');
			if (!port) {
				var s = uci.get_first('snmpd', 'agent');
				var addr = uci.get('snmpd', s['.name'], 'agentaddress');

				if (!addr)
					return null;

				addr = addr.toUpperCase();
				port = addr.match(/UDP6?:(\d+)/i);

				if (Array.isArray(port) && (port.length > 1))
					port = port[1];
			}
			return port;
		},

		go.write = L.bind(function(protocol, section_id, value) {
			var addr = [];
			var port = parseInt(value);
			var ip_protocol = protocol.formvalue(section_id);

			if (ip_protocol.match(/ipv4/g))
				addr.push('UDP:%d'.format(port));

			if (ip_protocol.match(/ipv6/g))
				addr.push('UDP6:%d'.format(port));

			if (addr.length > 0) {
				var s = uci.get_first('snmpd', 'agent');
				if (s)
					uci.set('snmpd', s['.name'], 'agentaddress', addr.join(','));
			}

			return form.Value.prototype.write.apply(this, [section_id, value]);
		}, go, this.ip_protocol);

		this.snmp_version = g.option(form.ListValue, 'snmp_version',
			_('SNMP version'),
			_('SNMP version used to monitor and control the device'));
		this.snmp_version.default = 'v1/v2c';
		this.snmp_version.rmempty = false;
		this.snmp_version.forcewrite = true;
		this.snmp_version.value('v1/v2c', _('SNMPv1 and SNMPv2c'));
		this.snmp_version.value('v1/v2c/v3', _('SNMPv1, SNMPv2c and SNMPv3'));
		this.snmp_version.value('v3', _('Only SNMPv3'));

		go = g.option(form.Value, "__agentxsocket", _("AgentX socket path"),
			_("Empty for disable AgentX"));
		go.rmempty = true;
		go.forcewrite = true;
		go.cfgvalue = function(section_id) {
			var s = uci.get_first('snmpd', 'agentx');
			var socket = uci.get('snmpd', s['.name'], 'agentxsocket');
			if (!socket)
				socket = this.default;
			return socket;
		};

		go.remove = function(section_id) {
			var s = uci.get_first('snmpd', 'agentx');
			if (s)
				s.remove('snmpd', s['.name']);
		};

		go.write = function(section_id, value) {
			var s = uci.get_first('snmpd', 'agentx');
			var sid = s ? s['.name'] : uci.add('snmpd', 'agentx');
			uci.set('snmpd', sid, 'agentxsocket', value);
		};
	},

	populateV1V2CSettings: function(subsection, desc, access, s, data) {
		var g, go, o, community, community_src, mode, mask;

		o = s.taboption("v1/v2c", form.SectionValue, "__v1/v2c__",
			form.GridSection, subsection, null, desc);

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;
		g.nodescriptions = true;
		g.modaltitle = desc;

		go = g.option(form.ListValue, "Mode", _("Access Control"),
			_("Access restriction to readonly or Read/Write"));
		go.value("rwcommunity", _("Read/Write"));
		go.value("rocommunity", _("Readonly"));

		community = g.option(form.Value, "CommunityName",
			_("Community Name"),
			_("Community that is used for SNMP"));
		community.datatype = "string";
		community.default = "";
		community.optional = false;
		community.rmempty = false;
		if(access == null) {
			if (uci.get("snmpd", "access_default", "Mode") === "rwcommunity") {
				this.rw_community_src = "default";
			} else {
				this.ro_community_src = "default";
			}
		}

		if (access !== null) {
			community_src = g.option(form.Value, access,
				_("Community source"),
				_("Trusted source for SNMP read community access (hostname or IP)"));
			community_src.value("default", _("any (default)"));
			community_src.value("localhost", "localhost");
			community_src.default = "default";
			community_src.optional = false;
			community_src.rmempty = false;
			community_src.datatype = "host(0)";

			if (access == "HostIP") {
				mask = g.option(form.Value, "IPMask",
					_("IPMask"),
					_("Prefix"));
				mask.rmempty = false;
				mask.datatype = "and(ip6prefix, ip4prefix)";
				mask.size = 2;
			}
		}

		go = g.option(form.ListValue, "RestrictOID",
			_("OID-Restriction"),
			_("Restriction to specific OID"));
		go.value("no", _("No"));
		go.value("yes", _("Yes"));
		go.default = "no";
		go.optional = false;
		go.rmempty = false;

		this.oid = g.option(form.Value,
			"RestrictedOID",
			_("OID"),
			_("Defined OID-branch that is restricted to"));
		this.oid.datatype = "string";
		this.oid.depends("RestrictOID", "yes");

		if (go === "rocommunity") {
			this.ro_community = community;
			this.ro_community_src = community_src;
		} else {
			this.rw_community = community;
			this.rw_community_src = community_src;
		}
	},

	render: function(data) {
		var m, s, o, g, go;

		m = new form.Map("snmpd",
			_("SNMP Settings"),
			_("On this page you may configure SNMP settings"));

		s = m.section(form.TypedSection, "snmpd");
		s.anonymous = true;
		s.addremove = false;

		s.tab("general", _("SNMP - General"));

		this.populateSystemSettings('general', s, data);
		this.populateGlobalSettings('general', s, data);

		s.tab("advanced", _("Advanced Settings"));

		o = s.taboption("advanced", form.SectionValue, "__advanced__",
			form.GridSection, "com2sec", null,
			_("Here you can configure com2sec options"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.Value, "secname", _("Secname"),
			_("Arbitrary label for use in group settings"));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, "source", _("Source"),
			_("Source describes a host or network"));
		go.rmempty = false;

		go = g.option(form.Value, "community", _("Community"),
			_("The community name that is used"));
		go.optional = false;
		go.rmempty = false;

		o = s.taboption("advanced", form.SectionValue, "__advanced__",
			form.GridSection, "group", null,
			_("Here you can configure group options"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.Value, "group", _("Group"),
			_("A group maps com2sec names to access names"));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, "version", _("Version"),
			_("The used version for the group"));
		go.value("v1", _("SNMPv1"));
		go.value("v2c" _("SNMPv2c"));
		go.value("usm", _("SNMPv3"));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, "secname", _("Secname"),
			_("Here you define which secname is mapped to the group"));
		go.optional = false;
		go.rmempty = false;

		o = s.taboption("advanced", form.SectionValue, "__advanced__",
			form.GridSection, "access", null,
			_("Here you can configure access options"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.Value, "group", _("Group"),
			_("The group that is mapped to the views (Read, Write, Notify)"));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, "context", _("Context"),
			_("The context of the request"));
		go.default = "none";
		go.modalonly = true;

		go = g.option(form.Value, "version", _("Version"),
			_("The used version for access configuration"));
		go.value("any", _("Any version"));
		go.value("v1", _("SNMPv1"));
		go.value("v2c" _("SNMPv2c"));
		go.value("usm", _("SNMPv3"));
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, "level", _("Level"),
			_("Level of security"));
		go.value("noauth", _("No authentication (standard for SNMPv1/v2c)"));
		go.value("auth", _("Authentication"));
		go.value("priv", _("Authentication and encryption"));
		go.default = "noauth";
		go.optional = false;
		go.rmempty = false;

		go = g.option(form.Value, "prefix", _("Prefix"),
			_("Specification how context of requests is matched to context"));
		go.value("exact", _("Exact"));
		go.value("prefix", _("Prefix"));
		go.optional = false;
		go.default = "excact";
		go.rmempty = false;

		go = g.option(form.Value, "read", _("Read"),
			_("Read access modification for groups"));
		go.value("all", _("All"));
		go.value("none", _("None"));
		go.default = "none";
		go.rmempty = false;
		go.modalonly = true;
		go.optional = false;

		go = g.option(form.Value, "write", _("Write"),
			_("Write access modification for groups"));
		go.value("all", _("All"));
		go.value("none", _("None"));
		go.default = "none";
		go.rmempty = false;
		go.modalonly = true;
		go.optional = false;

		go = g.option(form.Value, "notify", _("Notify"),
			_("Notify access modification for groups"));
		go.value("all", _("All"));
		go.value("none", _("None"));
		go.default = "none";
		go.rmempty = false;
		go.modalonly = true;
		go.optional = false;

		s.tab("v1/v2c", _("SNMPv1/SNMPv2c"));
		this.populateV1V2CSettings("access_default", _("Communities for any hosts"), null, s, data);
		this.populateV1V2CSettings("access_HostName", _("Communities via hostname"), "HostName", s, data);
		this.populateV1V2CSettings("access_HostIP", _("Communities via IP-Address range"), "HostIP", s, data);

		s.tab("v3", _("SNMPv3"));

		s.tab("traps", _("Traps", "SNMP"));

		return m.render();
	}
});
