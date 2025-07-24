import os from "node:os";
import { Netmask } from "@1tc/utils/netmask";

const nets = os.networkInterfaces();

function getNetworks() {
  let networks: Record<string, string> = {};
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === "IPv4" && !net.internal) {
        networks[net.address + "/24"] = net.address;
      }
    }
  }
  return networks;
}

export const passiveHostname = (address?: string | null): string => {
  if (!address) return "127.0.0.1";

  // const networks = {
  //     '$GATEWAY_IP/32': `${public_ip}`,
  //     '10.0.0.0/8'    : `${lan_ip}`
  // }
  const networks = getNetworks();
  for (const [network, hostAddress] of Object.entries(networks)) {
    if (new Netmask(network).contains(address)) {
      return hostAddress;
    }
  }
  return "127.0.0.1";
};
