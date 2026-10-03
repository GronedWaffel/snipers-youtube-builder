// SPDX-License-Identifier: MIT
function showSnipersDashboardPrompt(doc, width) {
    const panel=doc.createElement('div');
    panel.id='snipers-dashboard-prompt';
    Object.assign(panel.style,{
        position:'fixed',left:'3%',top:'22%',width:'90%',padding:'2%',
        backgroundColor:'#000000',border:'6px solid #ff3333',
        textAlign:'center',zIndex:'2147483647',fontFamily:'monospace'
    });
    const title=doc.createElement('div');
    title.textContent='GO TO DASHBOARD NOW';
    Object.assign(title.style,{color:'#ff3333',fontWeight:'bold',fontSize:Math.max(36,Math.floor(width*0.052))+'px'});
    const instruction=doc.createElement('div');
    instruction.textContent='Hold the PS button. Keep YouTube running.';
    Object.assign(instruction.style,{color:'#ffffff',fontSize:Math.max(22,Math.floor(width*0.025))+'px',marginTop:'24px'});
    const status=doc.createElement('div');
    Object.assign(status.style,{color:'#ffffff',fontSize:Math.max(20,Math.floor(width*0.021))+'px',marginTop:'20px'});
    status.textContent='etaHEN starts in 10 seconds.';
    panel.appendChild(title);panel.appendChild(instruction);panel.appendChild(status);
    doc.body.appendChild(panel);
    return {
        update(seconds){status.textContent=seconds>0?'etaHEN starts in '+seconds+' seconds.':'Stay on the dashboard while etaHEN loads.';},
        remove(){if(panel.parentNode)panel.parentNode.removeChild(panel);}
    };
}
