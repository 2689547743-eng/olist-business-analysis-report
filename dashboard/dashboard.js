'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const fmt = (value, decimals=0) => new Intl.NumberFormat('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(value);
  const money = value => `R$ ${fmt(value,2)}`;
  const pct = value => value == null ? '无可比数据' : `${value>=0?'+':''}${value.toFixed(1)}%`;
  const ratio = (a,b) => b ? (a/b-1)*100 : null;
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data, rows, state, category, history=[], current=[], previous=[], summary={}, productList=[], shownProducts=[], page=0, hasPrevious=false, priorStart, priorEnd;
  const pageSize=50;
  const monthOffset = (month,offset) => {const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+offset,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;};
  function totals(selected){
    let cents=0;const orders=new Set(),customers=new Set();
    for(const r of selected){cents+=r[6];orders.add(r[4]);customers.add(r[5]);}
    return {amount:cents/100,customers:customers.size,orders:orders.size,items:selected.length,
      order_amount:orders.size?cents/100/orders.size:null,item_price:selected.length?cents/100/selected.length:null};
  }
  function monthly(selected){
    const months=data.months.map(month=>({month,cents:0,items:0,orderSet:new Set(),customerSet:new Set()}));
    for(const r of selected){const m=months[r[0]];m.cents+=r[6];m.items++;m.orderSet.add(r[4]);m.customerSet.add(r[5]);}
    return months.map((m,i)=>({month:m.month,amount:m.cents/100,orders:m.orderSet.size,customers:m.customerSet.size,items:m.items,
      mom:i?ratio(m.cents,months[i-1].cents):null,yoy:i>=12?ratio(m.cents,months[i-12].cents):null}));
  }
  function options(el,values,labels=values){el.replaceChildren(...values.map((v,i)=>new Option(labels[i],String(v))));}
  function selectedRows(start,end,stateValue,categoryValue){return rows.filter(r=>r[0]>=start&&r[0]<=end&&(stateValue<0||r[1]===stateValue)&&(categoryValue<0||r[2]===categoryValue));}
  function computeProducts(selected){
    const map=new Map();
    for(const r of selected){let p=map.get(r[3]);if(!p){p={id:data.products[r[3]],category:data.categories[r[2]],cents:0,items:0,orders:new Set(),months:new Set()};map.set(r[3],p);}p.cents+=r[6];p.items++;p.orders.add(r[4]);p.months.add(r[0]);}
    return [...map.values()].map(p=>({id:p.id,category:p.category,amount:p.cents/100,items:p.items,orders:p.orders.size,item_price:p.cents/100/p.items,months:p.months.size}));
  }
  function ranks(selected,prev,dimension,mode){
    const map=new Map();
    for(const [list,key] of [[selected,'current'],[prev,'previous']])for(const r of list){const v=r[dimension];if(!map.has(v))map.set(v,{index:v,current:0,previous:0});map.get(v)[key]+=r[6];}
    return [...map.values()].map(v=>({...v,amount:v.current/100,change:(v.current-v.previous)/100}))
      .filter(v=>mode==='下降金额'?v.change<0:v.current>0)
      .sort((a,b)=>mode==='下降金额'?a.change-b.change||a.index-b.index:b.amount-a.amount||a.index-b.index).slice(0,10);
  }
  function plotLayout(height=300){return {height,margin:{l:10,r:14,t:12,b:35},paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',
    font:{family:'Arial, Microsoft YaHei, sans-serif',size:12,color:'#425466'},showlegend:false,
    xaxis:{showgrid:false,zeroline:false,automargin:true},yaxis:{gridcolor:'#edf0f3',zeroline:false,automargin:true},hoverlabel:{bgcolor:'white',font:{size:13}}};}
  const plotConfig={responsive:true,displayModeBar:false,locale:'en'};
  function chartAxes(trend){
    const ticks=trend.filter((_,i)=>i%Math.max(1,Math.ceil(trend.length/7))===0);
    const offset=(m,n)=>new Date(new Date(m+'-01T00:00:00Z').getTime()+n*86400000).toISOString();
    return {type:'date',tickmode:'array',tickvals:ticks.map(m=>m.month+'-01'),ticktext:ticks.map(m=>m.month),showgrid:false,zeroline:false,automargin:true,
      range:[offset(trend[0].month,-4),offset(trend.at(-1).month,4)]};
  }
  async function drawTrends(){
    const start=+$('start').value,end=+$('end').value,trend=history.slice(start,end+1);
    const amountLayout=plotLayout();amountLayout.xaxis=chartAxes(trend);amountLayout.yaxis.tickprefix='R$ ';amountLayout.yaxis.tickformat='~s';
    const isOrders=$('volume').value==='订单数',field=isOrders?'orders':'customers';
    const volumeLayout=plotLayout(268);volumeLayout.xaxis=chartAxes(trend);
    await Promise.all([
      Plotly.react('amount-chart',[{x:trend.map(m=>m.month+'-01'),y:trend.map(m=>m.amount),type:'scatter',mode:'lines+markers',line:{color:'#0f766e',width:3},marker:{size:6},fill:'tozeroy',fillcolor:'rgba(15,118,110,.07)',
        customdata:trend.map(m=>[m.month,pct(m.mom),pct(m.yoy)]),hovertemplate:'%{customdata[0]}<br>商品金额 R$ %{y:,.2f}<br>环比 %{customdata[1]}<br>同比 %{customdata[2]}<extra></extra>'}],amountLayout,plotConfig),
      Plotly.react('volume-chart',[{x:trend.map(m=>m.month+'-01'),y:trend.map(m=>m[field]),type:'scatter',mode:'lines+markers',line:{color:'#6366f1',width:2.5},marker:{size:6},customdata:trend.map(m=>m.month),hovertemplate:`%{customdata}<br>${isOrders?'订单数':'购买客户数'} %{y:,}<extra></extra>`}],volumeLayout,plotConfig)
    ]);
  }
  async function drawRanks(){
    const mode=$('rank-mode').value;
    $('ranking-caption').textContent=hasPrevious?`下降金额 = 当前区间 − 前一个等长区间（${priorStart} — ${priorEnd}）。`:'当前区间缺少完整比较期，仅展示商品金额排名；缩短月份范围可查看下降排名。';
    await Promise.all([[1,'state',data.states],[2,'category',data.categories]].map(async([dimension,name,labels])=>{
      const values=ranks(current,previous,dimension,mode),empty=$(`${name}-empty`),chart=$(`${name}-chart`);
      empty.hidden=!!values.length;chart.hidden=!values.length;
      if(!values.length){empty.textContent=mode==='下降金额'?'没有符合条件的下降项。':'暂无可展示的商品金额。';Plotly.purge(chart);return;}
      const layout=plotLayout(335);layout.margin.l=10;layout.xaxis.tickprefix='R$ ';layout.xaxis.tickformat='~s';
      layout.yaxis={showgrid:false,automargin:true,zeroline:false,categoryorder:'array',categoryarray:values.map(v=>labels[v.index]).reverse()};
      await Plotly.react(chart,[{x:values.map(v=>mode==='下降金额'?v.change:v.amount),y:values.map(v=>labels[v.index]),type:'bar',orientation:'h',marker:{color:mode==='下降金额'?'#d97757':'#0f766e'},
        customdata:values.map(v=>[v.amount,v.change]),hovertemplate:'%{y}<br>商品金额 R$ %{customdata[0]:,.2f}'+(hasPrevious?'<br>金额变化 R$ %{customdata[1]:+,.2f}':'')+'<extra></extra>'}],layout,plotConfig);
    }));
  }
  function drawMetrics(){
    const before=hasPrevious?totals(previous):null;
    const keys=[['商品金额','amount','选中商品明细金额'],['购买客户数','customers','当前范围去重'],['订单数','orders','含选中商品的订单去重'],['商品件数','items','选中商品明细行数'],['订单均商品金额','order_amount','选中金额 ÷ 订单数'],['件均价','item_price','选中金额 ÷ 商品件数']];
    $('metrics').innerHTML=keys.map(([label,key,desc])=>{
      const v=summary[key],isMoney=['amount','order_amount','item_price'].includes(key);
      const formatted=v==null?'—':key==='amount'&&v>=100000?`R$ ${fmt(v/10000,1)}万`:isMoney?money(v):fmt(v);
      const delta=before&&before[key]!=null&&before[key]!==0&&v!=null?ratio(v,before[key]):null;
      return `<article class="metric" data-metric="${key}"><div class="metric-body"><div class="metric-label">${label}</div><div class="metric-value" title="${v==null?'无可计算分母':isMoney?money(v):fmt(v)}">${formatted}</div><div class="metric-description">${desc}</div></div>${delta==null?'':`<div class="metric-delta"><span>${pct(delta)} · 前期</span></div>`}</article>`;
    }).join('');
    $('precise-amount').textContent=`当前范围精确商品金额：${money(summary.amount)}。指标卡中的“万”表示 10,000，图表悬停与 CSV 保留精确金额。`;
  }
  function drawTable(reset=true){
    if(reset)page=0;
    const search=$('search').value.trim().toLowerCase(),sort=$('sort').value;
    shownProducts=productList.filter(p=>!search||p.id.toLowerCase().includes(search)||p.category.toLowerCase().includes(search));
    const key=sort.startsWith('商品件数')?'items':sort.startsWith('件均价')?'item_price':'amount',ascending=sort.includes('从低到高');
    shownProducts.sort((a,b)=>(ascending?a[key]-b[key]:b[key]-a[key])||a.id.localeCompare(b.id));
    const pages=Math.max(1,Math.ceil(shownProducts.length/pageSize));page=Math.min(page,pages-1);
    $('table-caption').textContent=`共 ${fmt(shownProducts.length)} 个商品 · 继承全局筛选，搜索仅影响本表和商品导出。销售月份数表示区间内有销售记录的月份数。`;
    $('product-rows').innerHTML=shownProducts.slice(page*pageSize,(page+1)*pageSize).map(p=>`<tr><td>${escape(p.id)}</td><td>${escape(p.category)}</td><td class="number">${money(p.amount)}</td><td class="number">${fmt(p.items)}</td><td class="number">${fmt(p.orders)}</td><td class="number">${money(p.item_price)}</td><td class="number">${p.months}</td></tr>`).join('')||'<tr><td colspan="7">没有符合条件的商品。</td></tr>';
    $('page-label').textContent=`${page+1} / ${pages}`;$('prev-page').disabled=page===0;$('next-page').disabled=page>=pages-1;
  }
  function saveFilters(){try{localStorage.setItem('ecommerce-dashboard-filters-v1',JSON.stringify({start:+$('start').value,end:+$('end').value,state:+$('state').value,category:+$('category').value}));}catch{}}
  async function render(){
    const start=+$('start').value,end=+$('end').value;state=+$('state').value;category=+$('category').value;
    current=selectedRows(start,end,state,category);summary=totals(current);
    const count=end-start+1;priorStart=monthOffset(data.months[start],-count);priorEnd=monthOffset(data.months[start],-1);
    hasPrevious=start-count>=0;previous=hasPrevious?selectedRows(start-count,start-1,state,category):[];
    $('scope').textContent=`当前范围：${data.months[start]} — ${data.months[end]} ｜ ${state<0?'全部地区':data.states[state]} ｜ ${category<0?'全部品类':data.categories[category]}`+(hasPrevious?`　·　比较期：${priorStart} — ${priorEnd}`:'　·　前一个等长月份区间超出数据范围，不展示区间变化率');
    const boundary=[];if(end===19)boundary.push('2018 年 8 月最后一笔已送达订单的购买时间为 8 月 29 日，未确认覆盖完整自然月');if(start===0)boundary.push('2017 年 1 月最早记录为 1 月 5 日，月初覆盖情况未确认');
    $('boundary').textContent=boundary.length?'时间边界：'+boundary.join('；')+'。':'';$('boundary').hidden=!boundary.length;
    $('empty').hidden=!!current.length;
    const rankMode=$('rank-mode').value;options($('rank-mode'),hasPrevious?['商品金额','下降金额']:['商品金额']);if(hasPrevious)$('rank-mode').value=rankMode;
    history=monthly(rows.filter(r=>(state<0||r[1]===state)&&(category<0||r[2]===category)));
    productList=computeProducts(current);drawMetrics();drawTable();saveFilters();
    await Promise.all([drawTrends(),drawRanks()]);
    window.dashboardView={summary,history,currentProducts:productList,filteredProducts:shownProducts,scope:{start,end,state,category,hasPrevious}};
    document.dispatchEvent(new Event('dashboard-rendered'));
  }
  function download(name,headers,records){
    const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const text='\uFEFF'+[headers,...records].map(row=>row.map(quote).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function updateEnd(){const old=+$('end').value,start=+$('start').value;options($('end'),data.months.map((_,i)=>i).slice(start),data.months.slice(start));$('end').value=Math.max(start,old);}
  function fail(error){$('loading').hidden=false;$('loading').textContent='看板加载失败：'+error.message+'。请刷新页面，或使用最新版 Chrome、Edge、Firefox 或 Safari。';console.error(error);}
  async function init(){
    if(!window.Plotly)throw new Error('图表库未加载');
    if(!window.DecompressionStream)throw new Error('浏览器不支持压缩数据读取');
    const bytes=Uint8Array.from(atob(window.DASHBOARD_PACKED),c=>c.charCodeAt(0));
    data=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
    delete window.DASHBOARD_PACKED;rows=data.rows;
    options($('start'),data.months.map((_,i)=>i),data.months);options($('end'),data.months.map((_,i)=>i),data.months);$('end').value=data.months.length-1;
    options($('state'),[-1,...data.states.map((_,i)=>i)],['全部地区',...data.states]);options($('category'),[-1,...data.categories.map((_,i)=>i)],['全部品类',...data.categories]);
    try{const saved=JSON.parse(localStorage.getItem('ecommerce-dashboard-filters-v1'));if(saved&&Number.isInteger(saved.start)&&Number.isInteger(saved.end)&&saved.start>=0&&saved.end<20&&saved.end>=saved.start){$('start').value=saved.start;$('end').value=saved.end;updateEnd();if(saved.state>=-1&&saved.state<data.states.length)$('state').value=saved.state;if(saved.category>=-1&&saved.category<data.categories.length)$('category').value=saved.category;}}catch{}
    ['start','end','state','category'].forEach(id=>{$(id).disabled=false;$(id).addEventListener('change',()=>{if(id==='start')updateEnd();render().catch(fail);});});
    $('volume').addEventListener('change',()=>drawTrends().catch(fail));$('rank-mode').addEventListener('change',()=>drawRanks().catch(fail));
    let searchTimer;$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>drawTable(),150);});$('sort').addEventListener('change',()=>drawTable());
    $('prev-page').addEventListener('click',()=>{page--;drawTable(false);});$('next-page').addEventListener('click',()=>{page++;drawTable(false);});
    $('export-products').addEventListener('click',()=>download(`products_${data.months[+$('start').value]}_${data.months[+$('end').value]}.csv`,['商品 ID','品类','商品金额','商品件数','订单数','件均价','销售月份数'],shownProducts.map(p=>[p.id,p.category,p.amount.toFixed(2),p.items,p.orders,p.item_price.toFixed(2),p.months])));
    $('export-monthly').addEventListener('click',()=>download(`monthly_${data.months[+$('start').value]}_${data.months[+$('end').value]}.csv`,['月份','商品金额','购买客户数','订单数','商品件数','环比','同比'],history.slice(+$('start').value,+$('end').value+1).map(m=>[m.month,m.amount.toFixed(2),m.customers,m.orders,m.items,m.mom??'',m.yoy??''])));
    $('source-caption').textContent=`数据来源：本项目已清洗 SQLite 的 mart_order_items 与 mart_orders；快照生成时间：${data.provenance.built_at}。历史静态数据，重新生成并发布后才会刷新。`;$('source-sql').textContent=data.provenance.sql;
    window.Dashboard={totals,monthly,selectedRows,ranks,computeProducts,months:data.months,states:data.states,categories:data.categories};
    await render();$('loading').hidden=true;
  }
  init().catch(fail);
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{for(const id of ['amount-chart','volume-chart','state-chart','category-chart'])if($(id).data&&!$(id).hidden)Plotly.Plots.resize(id);},100);});
})();
