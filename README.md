# vscode-openflow

Openflow is the de facto standard for SDN, see [ovs](https://github.com/openvswitch/ovs)

Usually we will see the flows, meters, groups and so on with command line below:
```
ovs-ofctl dump-flows br-int
ovs-ofctl dump-meters br-int -O openflow13
ovs-ofctl dump-groups br-int
```

Though we have the ```ofproto/trace``` tool to help us analyze the flows, it could still be hard for us to pin-point mistake in the tables.
A real scenario in huge distributed system will have over ten thousands of flows or even more.

This aims to work as a helper to analyze the flows dumped out from the environment. Save the flows to a file ended with ```.ofp``` and open it with vscode and install this extension.

#### Feature
- sytax highlight
- flow table outline
- flow table mermaid flowchart
- todo: hint for possible conflict
- todo: hint for better ocherster of flows
