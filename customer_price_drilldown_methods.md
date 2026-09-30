# Olist 商品金额下降合并分析：方法、对账与限制

## 页面结构与复现入口

正式合并页为 `output/html/customer_price_drilldown.html`，导航后先展示两年结论速览，再依次包含四因素总览、客户分析、商品金额分析和汇总结论。速览数字动态取自月度金额基线及商品销售存在状态对账数据，并提供四个章节锚点；它将经营根因标为尚未证实，并说明客户与商品是同一交易的不同拆解。总览的 Shapley 算术贡献占比与商品销售存在状态净降额占比口径不同，不应相加。四因素图、月度金额、州人数差和 90 天购买历史旁的判断使用“发现、数值证据、解释边界、下一步”四项结构。商品金额部分由五个子节组成：品类分析、商品详情分析、两年结构对比、单一商品订单评分与评论、销售连续性。单一商品订单的葡语原文/中文翻译明细仍作为独立页面 `output/html/product_top20_single_order_bilingual_reviews.html`；它链接回主页面的评价区（`customer_price_drilldown.html#reviews`），也保留商品金额分析页与含多商品订单的完整评论页入口。当前合并页不展示旧版独立件均价下钻中的品类价格效应与同款匹配图表。

正式主页面可从现有汇总 CSV 快速重建。在仓库根目录运行：

```powershell
.\.venv\Scripts\python.exe .\Olist数据准备\build_customer_price_drilldown.py --from-csv
```

该命令读取 `output/data/` 中已生成的客户和商品下钻 CSV，写入正式 HTML；它不会重算 SQLite 数据、生成商品 CSV 或翻译评论。首次完整重建的依赖顺序、命令及翻译批次准备见仓库根目录 `README.md` 的“客户、商品金额与评价合并分析”。

## 统计口径

- 月份按 `order_purchase_timestamp` 划分；只保留最终 `order_status=delivered` 的订单。商品金额是 `mart_order_items.price_cents` 求和，不含运费；可加总金额以整数分输出，件均价输出 R$/item。
- `mart_orders` 一行一订单，`mart_order_items` 一行一商品明细。客户人数直接从订单粒度按月对 `customer_unique_id` 去重；商品金额和件数直接从明细粒度聚合，不把一对多表连接后计数。客户月明细仅在内存中处理，不导出或提交客户 ID。
- 客户当月归州/城市规则：取符合口径的当月最早购买时间对应订单；时间相同按 `order_id` 字典序升序。多地址客户当月只落入一个州/城市桶；另披露当月记录中出现多个已知州/城市的客户数。空州、空城市、空品类保留为 `(unknown)`。
- 旧版 `customer_state_city_top10.csv` 仍按每年州人数差绝对值选前三州，并按每月至少 10 位客户及州内绝对变化 Top 10 筛选城市；其余合并为汇总桶。当前页面的城市分析改用 `customer_city_monthly_delta_may_june_selected_states.csv` 全量城市月度汇总：SP 对比 2017/2018；并下钻 2017 年州降幅排名第 2、3 的 RJ/MG 和 2018 年的 RJ/RS。各州选六月减五月人数差最负的三个已知城市，变化率只作辅助口径，不参与排名，也不分析复购或客户流失。先在完整月份内为客户确定首笔已送达订单归属，再筛选目标州；每州人数按月与 `customer_state_monthly.csv` 完全对账。
- 州客户人数差图按各年人数差绝对值独立取 Top 10；变化率不再绘图，但完整州表和 CSV 仍保留变化率及排名。5 月基数为 0 时变化率未定义，基数小于 20 人不影响表中指标。
- 90 天历史标志比较每月月初前 90 天 `[起始日, 月初)` 的最终已送达订单。`此前 90 天未见购买`不等于真实新客；“仅 5 月购买”也不称作流失。
- 日趋势图逐日展示已送达订单客户在当日按 `customer_unique_id` 去重的人数（人/日），并叠加截至当日、含当日在内的过去 7 个自然日滚动平均；5 月开始的前 6 天窗口不足 7 天，CSV/悬停列明实际窗口天数。逐日去重人数可跨日重复同一客户，不能相加为月去重客户。连续自然周汇总仅作为补充表；星期几表报告出现天数和日均人数。
- 总览中的两张柱线叠加图分别展示 2017、2018 年 4—7 月已送达商品金额，来源为商品明细 `price_cents` 按购买月份求和，不含运费。每月柱高与折线点为同一金额，折线连接四个月观察值，两年使用相同金额纵轴范围。各月商品明细金额与订单粒度 `merchandise_cents` 对账；其中 5、6 月还须与 `monthly_customer_price_baseline.csv` 对账。2017 年呈先升、回落、再回升的波动，2018 年 6 月明显下滑、7 月仅小幅回升；不同走势提示驱动因素可能不同，但四个月的金额观察值本身不能确定经营原因。客户跨月流转人数表位于客户方向章节。

## 商品金额下降四因素总览

- 页面顶部的折叠基线表直接使用 `monthly_customer_price_baseline.csv` 同源的 `baseline` 数据框，按 2017/2018 年各自 5、6 月列出商品金额、商品明细行数和成交件均价。差额及相对 5 月变化率均由未舍入值计算；商品金额不含运费。
- 页面开头并排展示 2017、2018 年两张饼图，复用 `amount_shapley_reconciliation.csv` 的四因素 Shapley 金额贡献。因素固定为购买客户数、每位购买客户订单数、每单商品明细件数、每件平均价格；金额贡献以整数分计算并加总回当年 5→6 月商品金额差额。
- 各年因素占比 = `contribution_cents ÷ total_merchandise_change_cents × 100%`。本分析中分子与分母均为负，因此绘图采用正的分摊占比，并在每张饼图内合计为 100%；悬停信息展示精确占比、带符号金额贡献和该年总降额，紧邻表格列出完整占比及金额。该占比表示对已送达订单商品金额总降额的算术分摊，不是因素自身的变化率，也不是因果贡献。
- 四因素后另列每项指标 2017/2018 年 5、6 月的实际水平及各年 5→6 月差额/变化率，并单列 2018 相对 2017 的 5 月、6 月同比差额/变化率。客户数按月内 `customer_unique_id` 去重；订单/客户、明细件数/订单和 R$/件按表中定义计算。同比差额为 2018 减 2017，可能增加；各差额和百分比均由未舍入的指标值计算。
- Plotly.js 只嵌入 HTML 一次，页面可离线打开。

## 商品金额分析的五个子节

- **品类分析：**分别查看两年独立品类金额变化 Top 10、固定 2018 品类名单的跨年对照及全站金额对账。固定跨年名单与 2017 独立榜单回答不同问题。
- **商品详情分析：**按年份查看商品 ID 金额变化 Top 20、品类内商品排行及金额对账。商品金额按符合口径的已送达商品明细 `price_cents` 加总；各年榜单独立排序。
- **两年结构对比：**两年共同进入各自品类 Top 10 的品类用哑铃图比较，横轴为品类 5→6 月金额差除以当年 5 月全站商品金额；零线左侧为下降、右侧为增长，圆点和菱形分别表示 2017 与 2018 年。连线按横轴数值的跨年移动着色：2018 年高于 2017 年为红线，低于为绿线，相等为灰线；颜色不表示商品金额的同比增减。图中只含共同入榜品类，完整并集及另一年未入榜品类的真实金额放在可展开核对表。另比较商品 ID 结构；同名品类或商品入榜不能单独证明共同原因。
- **评分与评论：**评价只来自 Top 20 商品订单中整笔订单仅含一个不同商品 ID 的子样本。评分属于订单，同一订单多条评价先在订单内求平均；购买月份按购买时间确定。葡语原文与中文译文可在独立双语明细页筛选查看。
- **销售连续性：**按商品 ID 分为仅 5 月销售、仅 6 月销售、两月均销售三组，并核对分组金额变化回到全站金额差。仅 6 月销售属于抵消下降的增量，不是负向缺口。

## 存档：历史件均价与品类效应计算（当前合并页不展示）

以下公式、图表说明和 CSV 记录此前独立件均价下钻的计算背景，供审计旧结果使用。当前合并页不呈现这些品类件均价效应、同款匹配或匹配覆盖图表；当前商品金额分析见前文“五个子节”及其页面内对账表。

设 `w_ct` 为品类 c 在月 t 的商品明细行占全月明细行比例，`p_ct` 为该品类 `price_cents` 均值换算后的 R$/件。全站件均价 `P_t = Σ_c w_ct × p_ct`。两月都有销量的共同品类对称拆分：

- 品类组合效应：`Σ_common (w_c6 − w_c5) × (p_c5 + p_c6) / 2`。
- 共同品类组内均价效应：`Σ_common (p_c6 − p_c5) × (w_c5 + w_c6) / 2`。
- 单月出现品类效应：`Σ_仅6月 w_c6 × p_c6 − Σ_仅5月 w_c5 × p_c5`。缺席月不造价、不补零；此项只记一次性组合进出，不记组内价格变化。
- 三项以 R$/件计，逐年严格加总到全站件均价差。品类内件均价变化仍可能是不同 product_id / seller_id 构成变化，不说明同款挂牌价格变化。
- 历史分析中的品类销量 Top 10 和商品销量 Top 10 各先按每年 5 月 + 6 月已送达商品明细行数（每一行一件）选出固定十项；单项销量差为 6 月减 5 月，按差值绝对值降序排列。并列时先按两月合计销量排名，再按品类名或 product_id 字典序。商品榜排除空 product_id，并披露缺失行数。
- 月均价为该月该品类/商品商品金额分 ÷ 明细行数 ÷ 100。两月价格差为 6 月均价 − 5 月均价；变化率为差额 ÷ 5 月均价 × 100%。若任一月无销量，均价、差额和变化率留空，不补零。商品跨多个品类时完整列出所有观察到的品类值。
- 品类贡献占比图按每年单个品类的总效应绝对值选前十，其余所有品类合并为“其它”；图中不拆共同品类和单月品类，也不拆三项效应。每个品类总贡献等于其 6 月商品金额÷6 月全站件数减去 5 月商品金额÷5 月全站件数（金额换算成 R$/件）；占比为品类总贡献÷当年全站件均价净差×100%。净差为负时正占比推动下降，负占比抵消下降，单项可能超过 100%；前十与其它逐年合计为 100%。两年并列图的横轴各自缩放。
- 完整品类表继续保留三项算术拆解和逐年对账；图中前十及其它的占比和带符号 R$/件贡献另存 `category_price_share_top10_other.csv`。占比是全站净变化的算术分摊，不等于品类自身的件均价变化率。
- 同款商品榜只保留 5、6 月都有销量的 product_id，再按两月合计明细行数排名；均价使用当月实际 price。覆盖率同时报告明细行数和金额，以各月全站为分母。匹配样本不代表全站，price 不是标价，数据没有折扣或促销字段。
- 旧独立页曾以品类销量与 R$/件均价作为主视图，并提供全站均价效应核查；这些可视图表不属于当前合并页。

### 同款匹配与四因素金额换算

- 匹配集合是 5、6 月都出现过的非空 `product_id`；敏感性集合是都出现过的非空 `(product_id, seller_id)`。匹配行数及商品金额覆盖率的分母是各月全部符合口径的商品明细行和商品金额。未匹配行数、金额单独对账。
- 匹配子样本内再用对称公式拆为匹配商品 mix 与键内均价变化；另按 5 月匹配明细行占比固定商品组合，对比每个 product_id（或 product_id + seller_id）两月均价。固定 5 月组合可隔开商品键 mix 变化与键内均价变化，但仍只描述匹配子集，覆盖不足 100% 时不外推到全站。
- 若将件均价变化换成四因素金额 Shapley 的金额贡献，令 `x=(购买客户数, 每位客户订单数, 每单明细件数)`、件均价 `p` 单位为 R$/件，则 `φ_p = Δp × Σ_{S⊆x} [|S|! (3−|S|)! / 4!] × ∏_{i∈S}x_i,6 × ∏_{i∉S}x_i,5`，单位为 R$。这与 R$/件的品类效应不同，不能直接相加。四项金额贡献整体另存 CSV，并核对回商品金额差额。

## 当前合并页的基线与对账

| 年月 | 去重购买客户 | 商品明细行 | 商品金额（R$） | 件均价（R$/件） |
|---|---:|---:|---:|---:|
| 2017-05 | 3,479 | 4,004 | 489,338.25 | 122.2124 |
| 2017-06 | 3,076 | 3,489 | 421,923.37 | 120.9296 |
| 2018-05 | 6,693 | 7,810 | 977,544.69 | 125.1658 |
| 2018-06 | 6,061 | 7,010 | 856,077.86 | 122.1224 |

客户州汇总按月对账至全站去重客户数；州归属来自客户当月首笔已送达订单。脚本逐年、逐月断言州合计与全站人数一致。
客户流转恒等式逐年验证：`6 月客户数 − 5 月客户数 = 仅 6 月购买人数 − 仅 5 月购买人数`。见 `customer_flow_may_june.csv`。
商品金额四项 Shapley 贡献以整数分严格加总，见 `amount_shapley_reconciliation.csv`。当前商品分析还分别核对品类榜、商品榜、评论样本和销售连续性分组；各节的对账表与下载明细在主页面商品方向部分。

## 复现

从原始数据完整重建时，在仓库根目录 PowerShell 中运行（原始九张 CSV 留在仓库外）。先运行 `prepare_olist.py`（若 SQLite/mart 缺失或过期），再以 `--data-only` 生成客户数据、月度金额基线和重点州全量城市人数差 CSV，然后依次生成商品金额、评论、销售连续性数据、双语评论 HTML、独立商品金额 HTML，最后以 `--from-csv` 重建正式合并页。精确命令和必须预先准备的人工审核翻译批次见 `README.md` 的重建步骤。

```powershell
$DataDir = 'D:\path\to\olist-csv'
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\Olist数据准备\requirements-dual-year.txt
.\.venv\Scripts\python.exe .\Olist数据准备\prepare_olist.py --data-dir $DataDir --output-dir .\Olist数据准备
.\.venv\Scripts\python.exe .\Olist数据准备\build_customer_price_drilldown.py --data-only --db .\Olist数据准备\olist_clean.sqlite --output-dir .\output
.\.venv\Scripts\python.exe .\Olist数据准备\build_product_amount_drilldown_data.py --db .\Olist数据准备\olist_clean.sqlite --output-dir .\output\data
.\.venv\Scripts\python.exe .\Olist数据准备\build_product_top20_single_order_reviews_data.py --db .\Olist数据准备\olist_clean.sqlite --top20 .\output\data\product_amount_product_top20.csv --outdir .\output\data
.\.venv\Scripts\python.exe .\Olist数据准备\build_product_sales_presence_data.py
# 按本次生成的翻译输入清单准备/复核三个 translations_batch CSV 后继续
.\.venv\Scripts\python.exe .\Olist数据准备\build_product_top20_single_order_bilingual_html.py
.\.venv\Scripts\python.exe .\Olist数据准备\build_product_amount_drilldown_html.py
.\.venv\Scripts\python.exe .\Olist数据准备\build_customer_price_drilldown.py --from-csv
```

快速仅重建现有 CSV 对应的正式合并 HTML 时，只运行 `.\.venv\Scripts\python.exe .\Olist数据准备\build_customer_price_drilldown.py --from-csv`。若还需刷新独立商品金额 HTML，再运行 `.\.venv\Scripts\python.exe .\Olist数据准备\build_product_amount_drilldown_html.py`。评论数据生成器按文本清单生成 `product_top20_single_order_review_translation_input_*.csv`，不自动翻译，也不生成 `translations_batch` 文件。双语页面生成器要求三个 `product_top20_single_order_review_translations_batch_*.csv` 与各自输入的 `translation_key` 一一匹配，并包含 `review_title_zh`、`review_message_zh`、`translation_status`、`translation_note` 列（状态为 `已翻译` 或 `待复核`）；可选修订写入 `product_top20_single_order_review_translation_corrections.csv`。重建后若翻译清单变化，需先按新 key 清单更新人工审核批次，再生成双语评论页。

数据脚本核对四个月基线、订单层与明细层商品金额、州人数总和、城市对州对账、客户跨月流转、评论样本边界、商品榜与销售连续性金额对账，以及四因素 Shapley 金额贡献。客户 ID 只在计算过程中使用，不写入汇总 CSV。

仅重算重点州城市人数差 CSV 时，可运行 `python .\Olist数据准备\build_city_customer_delta_data.py`；默认读取 `olist_clean.sqlite`，写入 1,221 行城市汇总，不输出客户 ID。

## 当前页面限制

Olist 未提供年龄、性别、获客渠道、标价、折扣、促销、库存或竞争信息，也没有完整退款信息。因此无法核实真实获客变化、定价/促销变动、商品库存约束或其他经营成因。四因素 Shapley 结果是金额变化的算术分摊，不代表因果。评分与评论仅覆盖 Top 20 商品中满足单一商品订单条件的样本，不能代表全部商品金额；缺失评分不按 0 分处理。

日历日期与星期只能描述观测到的客户购买分布；不同星期出现次数不同，需看日均数及分母。该描述不证明季节性或因果。

客户质量字段记录了月内多州/多城市客户数、未知州人数和客户 ID 缺失数；客户首单州是基于订单地址的月内归属规则，不代表稳定居住地。

### 机器核查摘要

- 州明细行：54；州汇总对账检查行：4。
- 客户流转年份：2017, 2018；逐年恒等式均通过。
- 四个月基线：4 行；两年四因素 Shapley 对账：8 行。

## 文件与 CSV 字段约定

分析 CSV 位于 `output/data/`；所有可加总金额以整数分保存。`customer_state_city_top10.csv` 仅包含三个最大州变动的 Top 10 城市、其他城市及未知城市。商品方向完整明细和对账表由商品金额页面的下载区列出。下表也保留旧独立件均价计算导出的 CSV 说明；标有 `category_price_*`、`matched_product_*`、`category_sales_top10.csv`、`product_sales_top10.csv` 和 `price_amount_shapley_conversion.csv` 的文件是历史辅助结果，不是当前合并页展示内容。

| 文件 | 粒度 | 内容 |
|---|---|---|
| `monthly_customer_price_baseline.csv` | 月份（4 行） | 订单数、去重客户、明细行、商品金额与全站件均价基线 |
| `customer_state_monthly.csv` | 年份 × 州（全州） | 客户数、变化、变化率、对全站净变化的算术贡献占比 |
| `customer_state_city_top10.csv` | 年份 × 最大变动州 × 城市/汇总桶 | 旧版城市样本下钻汇总；保留未知城市与其他城市对账桶 |
| `customer_city_monthly_delta_may_june_selected_states.csv` | 年份 × 重点州 × 城市（1,221 行） | 六个目标州年的完整城市月人数、六月减五月人数差、变化率和人数降幅排名；仅汇总数据，不含客户 ID |
| `customer_flow_may_june.csv` | 年份 × 跨月流转组 | 仅 5 月、两月都有、仅 6 月客户数及净差恒等式 |
| `customer_prior_90_day_activity.csv` | 月份 × 月初前 90 天分组 | 此前 90 天是否观察到已送达购买 |
| `customer_month_quality.csv` | 月份（4 行） | 月内多州/多城市人数、州对账、月长与日观察次数差 |
| `daily_unique_customers.csv` | 购买日期 | 每日去重客户、订单、过去 7 日滚动日均及窗口天数；客户 ID 不导出 |
| `daily_merchandise_amount.csv` | 购买日期（2017/2018 年各 5—6 月，共 122 行） | 历史逐日商品金额与 7 日均值数据，保留供复查；当前主图使用下方月度文件 |
| `monthly_merchandise_amount_apr_jul.csv` | 年份 × 月份（2017/2018 年各 4—7 月，共 8 行） | 每月已送达商品金额与明细行数；对账订单金额及 5、6 月基线 |
| `weekly_unique_customers.csv` | 年份 × 连续自然周 | 实际覆盖日期与天数、周内去重客户、该周日均客户和订单 |
| `weekday_unique_customers.csv` | 月份 × 星期几 | 出现天数、日均客户、日客户观察次数和月去重客户分母 |
| `daily_customer_month_summary.csv` | 月份（4 行） | 月长、月去重客户、日均客户与日人数求和差 |
| `category_price_effects.csv` | 年份 × 品类（全品类） | 明细行数、占比、商品金额、R$/件与三类贡献 |
| `category_price_decomposition.csv` | 年份（2 行） | 全站件均价和品类组合/组内/单月效应对账 |
| `category_price_top10.csv` | 年份 × 品类 Top 10 | 按品类总效应绝对值排序，保留正向抵消项 |
| `category_price_share_top10_other.csv` | 年份 × 品类 Top 10＋其它 | 占当年全站件均价净差的带符号百分比及 R$/件贡献；逐年合计 100% |
| `category_sales_top10.csv` | 年份 × 品类销量 Top 10 | 先按该年 5、6 月合计明细行数选 Top 10，再按销量差绝对值降序；含月度金额、件数、销量差、均价及差额/变化率 |
| `product_sales_top10.csv` | 年份 × product_id 销量 Top 10 | 先按两月合计明细行数选 Top 10，再按销量差绝对值降序；保留完整商品 ID、所属品类与月度均价 |
| `matched_product_sales_top10.csv` | 年份 × 两月共同 product_id Top 10 | 按两月合计明细行数排名；显示匹配样本两月实际成交件均价和月度件数 |
| `matched_product_price_summary.csv` | 年份 × 匹配键方法 | 匹配键数量、件数/金额覆盖、固定 5 月组合价格检验 |
| `matched_product_price_decomposition.csv` | 年份 × 匹配键方法 × 效应 | 匹配子样本 mix 与键内均价拆解 |
| `matched_product_key_detail.csv` | 年份 × 两月共同商品键 | product_id 或 product_id + seller_id 聚合明细 |
| `amount_shapley_reconciliation.csv` | 年份 × 四因素 | 商品金额变动的整数分 Shapley 算术贡献 |
| `price_amount_shapley_conversion.csv` | 年份（2 行） | R$/件变化换算为商品金额 Shapley 贡献；单位分开 |
