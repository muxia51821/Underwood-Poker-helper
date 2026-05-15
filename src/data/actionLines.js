export const underBluff = [
          {
            line: '3IA-XX-R-',
            text: '静态flop XX（控池），转牌后raise（追池）。flop和turn互相矛盾，尊重后者的真实意图。',
          },
          {
            line: 'SIA-Bm-Bb-Bs',
            text: '有利位置连开三枪。flop 0.5pot、turn 0.75极化、河牌 0.33pot 薄价值下注。河牌 0.66+ 一般是价值下注。',
          },
          {
            line: 'SIA-B-B-B',
            text: '有利位置有A的牌面连开三枪，诈唬不足。（有A的牌面河牌对手AK/AQ都会下注，诈唬不足）',
          },
          {
            line: 'SIA-Bb-',
            text: '有利位置进攻方flop就极化下注 0.75-1pot，可能对手转牌会X，但我们依旧不应过度防守。',
          },
          {
            line: 'SOD-XX-CX-DBb',
            text: '河牌坚果发生改变（听牌都到了），对手DBb较大尺度，诈唬不足。',
          },
          {
            line: 'SOD-XX-CR / -XR',
            text: '翻牌XC，转牌或河牌面对不对顶的大尺度下注仍然做XR。这里一般诈唬不足（我们可以弃AA单对的牌力）。',
          },
          {
            line: '多人池的前位DB',
            text: '多人池领先下注意味着要么是强牌担心X损失价值，要么是鱼钓强牌提前寻求打光。',
          },
          {
            line: '3OD-DB(不见AK)',
            text: '不利位置冷call 3B，flop没有A或K的DB，一般是超对（KK/QQ/JJ）。TT/99/88会过牌。',
          },
          {
            line: '多人池的河牌才下注',
            text: 'flop XX - turn XX - 河牌DB。河牌下注更像是薄价值下注。我们抓诈的阈值要更高。',
          },
          {
            line: '多人池前位/中位 BC-DBb-DBb',
            text: '多人池中位，flop BC，转牌或河牌抽花/抽顺已到，turn DBb河牌继续DBb，诈唬不足。',
          },
        ];
export const overBluff = [
          {
            line: 'SOD-DBs-m',
            text: '单挑底池的DB一般是弱成牌居多。策略：flop float，转牌价值降频打，诈唬raise。',
          },
          {
            line: 'SOD-XX-probes',
            text: '不利位置防守方，flop双方XX，转牌对手小尺度试探下注，诈唬过度。策略：turn call，river摊不赢的raise诈唬。',
          },
          {
            line: '3OD-XC-XX-DBs',
            text: '宽范围。XC-XX弱范围-DBs消化很多诈唬。如果是DBb应该是价值。',
          },
          {
            line: 'SIAe-B-',
            text: '有利位置宽范围，持续下注频率过高。我们抵抗策略可以是高频XR，对手会过度弃牌。',
          },
          {
            line: 'SIA-B-(掉A)',
            text: '有利位置进攻方，flop下注后掉A。此场景诈唬过度。河牌对手继续下注肯定是诈唬不足。',
          },
          {
            line: 'SID-stab',
            text: '有利位置防守方，在我们过牌后对手stab下注过度。策略：我们应在不利位置全范围过牌找对手马脚。',
          },
          {
            line: 'SID-XX-B',
            text: '有利位置防守方，我们连续过牌。对手如果是强牌flop需要下注，转牌会下注很多空气诈唬牌。',
          },
          {
            line: '对手是进攻方flop下注尺度较小',
            text: '如果SPR较深，对手flop下注小尺度，更可能是中等牌而非强牌。策略：flop float，turn能摊赢的call，不能的为效率小尺度raise诈唬。',
          },
          { line: '3OA-Bs-XX-Bs-m', text: '这条行动线目前尚不明确是否是诈唬过度。' },
        ];
