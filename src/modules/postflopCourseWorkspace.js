import rawCourse from '../data/solutions/turn-river-course.json' with { type: 'json' };
import { Utils } from '../utils.js';
import { DecisionWorkspaceStore } from '../store/decisionWorkspaceStore.js';
import { RANGE_HANDS } from './preflopRangeModel.js';
import { validateCourse, courseNode, courseHand, courseReference, courseActionLabel,
  startCourseRound, answerCourseRound, nextCourseDecision } from './postflopCourseModel.js';

const COURSE = validateCourse(rawCourse);
const esc = value => Utils.escapeHtml(String(value ?? '')).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const cards = value => Utils.renderCardBadges(Array.isArray(value) ? value.join(' ') : value.match(/.{2}/g).join(' '), {});
const number = value => Utils.safeFixed(value, 3);
const labels = { AhQh: 'A 高同花听牌', KhQd: '顶对与价值边界', QdQc: '中等摊牌价值', '7h7c': '暗三条建设底池', Th9h: '同花听牌的进攻', AcJc: 'A 高牌是否开火' };
const prompt = hand => hand === '7h7c' ? '你希望哪些更弱牌继续？怎样给河牌留下价值下注的空间？'
  : ['AhQh', 'Th9h'].includes(hand) ? '过牌和下注分别靠什么获利？如果被跟，哪些河牌让你继续，哪些让你停下？'
    : hand === 'KhQd' ? '哪些更弱牌会跟注？被跟之后，河牌是否还能继续取价值？'
      : '你的摊牌价值有多大？如果下注，准备让哪些牌弃掉？';
const riverText = card => ({ Ac: 'A 高张出现：重看顶对与摊牌价值。', '6h': '第三张红桃出现：检查自己的同花与阻断。', '7c': '公共牌配对：重新判断价值目标与对手继续范围。' })[card] || '对照原计划，重新判断河牌。';

function rangeView(course, node, player) {
  const baseline = new Map(courseNode(course, 'root').ranges[player]);
  const current = new Map(node.ranges[player]);
  const largest = Math.max(...current.values(), 0.001);
  const changes = [...new Set([...baseline.keys(), ...current.keys()])].map(hand => ({ hand, now: current.get(hand) || 0,
    change: (current.get(hand) || 0) - (baseline.get(hand) || 0) })).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 6);
  return '<details class="course-ranges"><summary>' + (player ? 'BTN' : 'BB') + ' 的范围怎么变了</summary><p class="ws-muted">格子亮度表示该手牌类别在本节点范围中的占比；表格列出当前占比和相对起点的变化。</p><div class="course-matrix">' + RANGE_HANDS.map(h => '<span title="' + h + ' ' + number((current.get(h) || 0) * 100) + '%" style="opacity:' + (current.has(h) ? 0.3 + 0.7 * Math.sqrt(current.get(h) / largest) : 0.15) + '">' + h + '</span>').join('') + '</div><table class="solution-values"><thead><tr><th>类别</th><th>现在占比</th><th>与起点相比</th></tr></thead><tbody>' + changes.map(v => '<tr><td>' + esc(v.hand) + '</td><td>' + number(v.now * 100) + '%</td><td>' + (v.change > 0 ? '+' : '') + number(v.change * 100) + ' 个百分点</td></tr>').join('') + '</tbody></table></details>';
}
function referenceView(course, round, nodeId) {
  const n = courseNode(course, nodeId), answer = round.responses[nodeId];
  return '<section class="course-feedback" data-course-feedback><h4>与你的判断对照</h4><p>你选择了 <strong>' + esc(courseActionLabel(answer.choice, n)) + '</strong>。下表列出这一手牌在当前节点的参考数据。</p><table class="solution-values"><thead><tr><th>动作</th><th>参考频率</th><th>与最高参考期望值差</th></tr></thead><tbody>' + courseReference(course, nodeId, round.cards).map(v => '<tr' + (v.id === answer.choice ? ' class="course-picked"' : '') + '><th>' + esc(courseActionLabel(v.id, n)) + '</th><td>' + number(v.frequency * 100) + '%</td><td>' + (v.relativeEvBb === null ? '未计算' : Utils.safeFixed(v.relativeEvBb, 4) + 'bb') + '</td></tr>').join('') + '</tbody></table></section>';
}
export const PostflopCourseWorkspace = {
  root: null, container: null, hash: null, timer: null, notice: '',
  init(root) {
    this.root = root;
    if (root.dataset.courseBound) return;
    root.dataset.courseBound = 'true';
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-course-action]'); if (!button) return;
      if (this.flushDraft() === false) return;
      const action = button.dataset.courseAction;
      if (action === 'start') this.start(button.dataset.courseHand || COURSE.hands[0]);
      if (action === 'submit') this.submit();
      if (action === 'next') this.update(entry => { const r = entry.rounds.find(r => r.id === entry.selectedId); return this.replace(entry, nextCourseDecision(entry.snapshot, r)); });
      if (action === 'home') this.update(entry => ({ ...entry, selectedId: null }));
      if (action === 'history') { this.hash = button.dataset.courseHash; this.update(entry => ({ ...entry, selectedId: button.dataset.courseRound })); }
      if (action === 'repeat') { const { entry, round } = this.current(); this.start(round.cards, round.riverCard || null, entry.snapshot); }
      if (action === 'stop') this.update(entry => { const r = entry.rounds.find(r => r.id === entry.selectedId); return this.replace(entry, { ...r, status: 'stopped', endedAt: new Date().toISOString(), endReason: '本次主动结束' }); });
    });
    root.addEventListener('input', event => {
      if (!event.target.matches('[data-course-draft]')) return;
      clearTimeout(this.timer);
      const draft = this.visibleDraft();
      if (draft) this.timer = setTimeout(() => this.saveDraft(draft), 250);
    });
    window.addEventListener('pagehide', () => { if (this.container?.isConnected) this.flushDraft(); });
  },
  current() {
    const library = DecisionWorkspaceStore.read().turnRiverCourses || {};
    if (!this.hash) this.hash = Object.keys(library).find(h => library[h].rounds.some(r => r.status === 'active')) || COURSE.contentHash;
    const entry = library[this.hash] || { snapshot: COURSE, rounds: [], selectedId: null };
    return { library, entry, round: entry.rounds.find(r => r.id === entry.selectedId) };
  },
  replace(entry, round) { return { ...entry, rounds: entry.rounds.map(r => r.id === round.id ? round : r) }; },
  showNotice(text) {
    this.notice = text; const target = this.container?.querySelector('[data-course-notice]');
    if (target) { target.textContent = text; target.hidden = !text; }
  },
  update(transform, render = true, hash = this.hash) {
    try {
      DecisionWorkspaceStore.change(state => {
        const library = state.turnRiverCourses || {};
        const entry = library[hash] || { snapshot: COURSE, rounds: [], selectedId: null };
        return { ...state, turnRiverCourses: { ...library, [hash]: transform(entry) } };
      });
      this.notice = ''; if (render) this.render(); return true;
    } catch (error) { this.showNotice(error.message); return false; }
  },
  start(hand, river = null, snapshot = COURSE) {
    this.hash = snapshot.contentHash;
    this.update(entry => {
      const round = startCourseRound(snapshot, hand, river);
      return { ...entry, snapshot, selectedId: round.id,
        rounds: [...entry.rounds.map(r => r.status === 'active' ? { ...r, status: 'stopped', endReason: '另开一轮学习' } : r), round] };
    });
  },
  primary() {
    const { round } = this.current();
    if (round) this.container?.querySelector('[data-course-question], [data-course-summary]')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    else this.start(COURSE.hands[0]);
  },
  visibleDraft() {
    const bound = this.container?.dataset;
    if (!bound?.courseRoundId) return null;
    const fields = this.container?.querySelectorAll('[data-course-draft]'); if (!fields?.length) return null;
    return { hash: bound.courseHash, roundId: bound.courseRoundId, nodeId: bound.courseNodeId,
      fields: Object.fromEntries([...fields].map(f => [f.dataset.courseDraft, f.value])) };
  },
  saveDraft(draft) {
    return this.update(entry => ({ ...entry, rounds: entry.rounds.map(r => {
      if (r.id !== draft.roundId) return r;
      if (draft.fields.summary !== undefined) return { ...r, summary: draft.fields.summary };
      if (r.nodeId !== draft.nodeId || r.responses[draft.nodeId]?.submitted) return r;
      return { ...r, responses: { ...r.responses, [draft.nodeId]: { submitted: false, reason: draft.fields.reason || '', plan: draft.fields.plan || '' } } };
    }) }), false, draft.hash);
  },
  flushDraft() { clearTimeout(this.timer); this.timer = null; const draft = this.visibleDraft(); return draft ? this.saveDraft(draft) : true; },
  submit() {
    const choice = this.container.querySelector('[name=courseChoice]:checked')?.value;
    if (!choice) return this.showNotice('先选一个行动，再查看参考。');
    const reason = this.container.querySelector('[data-course-draft=reason]')?.value || '';
    const plan = this.container.querySelector('[data-course-draft=plan]')?.value || '';
    this.update(entry => { const r = entry.rounds.find(r => r.id === entry.selectedId); return this.replace(entry, answerCourseRound(entry.snapshot, r, choice, reason, plan)); });
  },
  render(container = this.container) {
    this.container = container; if (!container) return;
    let current;
    try { current = this.current(); } catch (error) { container.innerHTML = '<p role="alert">' + esc(error.message) + '</p>'; return; }
    const { library, entry, round } = current, course = entry.snapshot;
    container.dataset.courseHash = course.contentHash;
    container.dataset.courseRoundId = round?.id || '';
    container.dataset.courseNodeId = round?.nodeId || '';
    const allRounds = Object.entries(library).flatMap(([hash, e]) => e.rounds.map(r => ({ hash, r }))).sort((a, b) => b.r.startedAt.localeCompare(a.r.startedAt));
    const header = this.root?.querySelector('[data-study-practice]'); if (header) header.textContent = round ? '继续本线' : '开始一条行动线';
      container.innerHTML = '<section class="postflop-course" data-course><div class="ws-section-heading"><div><p class="ws-eyebrow">转牌 → 河牌</p><h3>' + esc(course.title) + '</h3></div><span class="course-badge">研究样例 · 数据待核验</span></div><p class="ws-lead">先判断转牌行动，再用河牌检验后续计划。</p><p data-course-notice role="alert"' + (this.notice ? '' : ' hidden') + '>' + esc(this.notice) + '</p>' +
      '<div class="course-layout"><article>' + (round ? this.roundView(course, round) : this.homeView(course, allRounds)) + '</article><aside class="course-sidebar"><section class="ws-concept"><h4>这次在学什么</h4><ol><li>用范围判断二枪的价值与诈唬。</li><li>下注被跟后，重看剩下哪些牌。</li><li>面对不同河牌，修正原计划。</li></ol><p class="ws-muted">课内河牌：A♣、6♥、7♣。选择河牌后对照转牌计划。</p></section><section class="ws-concept"><h4>学习记录</h4>' + (allRounds.length ? allRounds.slice(0, 12).map(({ hash, r }) => '<button class="course-history" data-course-action="history" data-course-hash="' + hash + '" data-course-round="' + esc(r.id) + '"><span>' + cards(r.cards) + '</span><span>' + (r.status === 'active' ? '未完成 · 继续' : '回看判断') + '</span></button>').join('') : '<p class="ws-muted">完成一条线后，在这里找回理由、计划和总结。</p>') + '</section></aside></div>' +
      '<details class="course-source"><summary>局面、范围与数据来源</summary><p>9max／200bb 目标档案中的双人 BTN 对 BB 单加注底池；入池范围为手工假设，Rake 0，ICM 未计。</p><p>翻牌 Ks 7d 2h，底池 5.5bb。BB 过牌，BTN 下注 2.75bb，BB 跟注。转牌 8h，BB 过牌后开始；底池 11bb，双方剩余 194.75bb。</p><p>' + esc(course.conditions.tree) + '</p><p>OOP（BB）翻牌入池范围：' + esc(course.conditions.rangeSource.flopEntryClasses[0]) + '</p><p>IP（BTN）翻牌入池范围：' + esc(course.conditions.rangeSource.flopEntryClasses[1]) + '</p><p>父策略第 ' + esc(course.source.parentIteration) + ' 轮；本课数值由 ' + esc(course.source.engine) + ' 离线导出，代码许可 ' + esc(course.source.license) + '。</p><p>版本 ' + esc(course.contentHash.slice(0, 12)) + '</p></details></section>';
  },
  homeView(course, rounds) {
    const active = rounds.find(v => v.r.status === 'active');
    return '<section class="course-intro"><p class="course-context">BTN vs BB · 翻牌下注被跟 · 转牌 8♥</p><div class="course-board">' + cards(course.conditions.board) + '</div><p>底池 <strong>11bb</strong> · 双方剩余 <strong>194.75bb</strong> · BB 已过牌，轮到你。</p><h4>选一种手牌，做完一条行动线</h4><div class="course-hand-list">' + course.hands.map(h => '<button class="course-hand" data-course-action="start" data-course-hand="' + h + '">' + cards(h) + '<span>' + esc(labels[h] || h) + '</span><small>转牌判断 → 河牌计划 → 回看</small></button>').join('') + '</div>' + (active ? '<button class="ws-button ws-button--primary" data-course-action="history" data-course-hash="' + active.hash + '" data-course-round="' + esc(active.r.id) + '">继续上次未完成的行动线</button>' : '') + '</section>';
  },
  roundView(course, round) {
    const node = courseNode(course, round.nodeId), response = round.responses[node.id];
    const finished = round.status !== 'active';
    const steps = ['看局面', '转牌判断', '河牌判断', '回看与总结'];
    const at = finished ? 3 : node.board.length === 5 ? 2 : 1;
    const trail = round.events.map(e => { const n = courseNode(course, e.nodeId); return '<li>' + (e.actor === 'deal' ? '河牌 ' + cards([e.actionId]) : (e.actor === 1 ? '你（BTN）' : 'BB') + ' · ' + esc(courseActionLabel(e.actionId, n))) + '</li>'; }).join('');
    const earlier = Object.entries(round.responses).filter(([id, r]) => id !== round.nodeId && r.submitted);
    return '<div class="course-stepper">' + steps.map((s, i) => '<span' + (i === at ? ' aria-current="step"' : '') + '>' + (i + 1) + ' ' + s + '</span>').join('') + '</div><div class="practice-toolbar"><button class="ws-button" data-course-action="home">返回专项</button>' + (!finished ? '<button class="ws-button" data-course-action="stop">结束本线并总结</button>' : '') + '</div><section class="course-table"><p>你在 BTN · ' + cards(round.cards) + '</p><div class="course-board">' + cards(node.board) + '</div><p>底池 <strong>' + number(node.potBb) + 'bb</strong> · 剩余 BB ' + number(node.stacksBb[0]) + 'bb／你 ' + number(node.stacksBb[1]) + 'bb</p>' + (trail ? '<details open><summary>已经发生的行动</summary><ol class="course-trail">' + trail + '</ol></details>' : '<p>翻牌下注被跟，转牌 BB 已过牌。</p>') + '</section>' +
      (finished ? '<section data-course-summary><h4>回看与总结</h4><p>' + esc(round.endReason) + '</p>' + this.reviewView(course, round) + '<label class="course-field">这条线你会带走什么？<textarea data-course-draft="summary" rows="3" placeholder="写一个下次能用的判断，不必背频率。">' + esc(round.summary) + '</textarea></label><button class="ws-button ws-button--primary" data-course-action="repeat">同手牌、同河牌再试一次</button></section>' :
        '<section data-course-question><h4>' + (node.board.length === 4 ? '转牌：继续下注，还是留下摊牌价值？' : '河牌：现在还按原计划行动吗？') + '</h4><p>' + esc(node.board.length === 4 ? prompt(round.cards) : riverText(node.board[4])) + '</p>' +
        (node.board.length === 5 && earlier.length ? '<blockquote class="course-prior"><strong>你在转牌的计划</strong><p>' + esc(earlier[0][1].plan || '当时没有写后续计划，现在补想一下发生了什么变化。') + '</p></blockquote>' : '') +
        (response?.submitted ? referenceView(course, round, node.id) + '<div class="course-answers"><p><strong>你的理由：</strong>' + esc(response.reason || '未填写') + '</p><p><strong>后续计划：</strong>' + esc(response.plan || '未填写') + '</p></div><button class="ws-button ws-button--primary" data-course-action="next">沿这个选择继续</button>' :
          '<fieldset class="course-choices"><legend>你会怎样行动？</legend>' + node.actions.map(a => '<label><input type="radio" name="courseChoice" value="' + esc(a.id) + '"><span>' + esc(courseActionLabel(a.id, node)) + '</span></label>').join('') + '</fieldset><label class="course-field">这一步的理由<textarea data-course-draft="reason" rows="2" placeholder="你希望哪些牌跟注、哪些牌弃牌？">' + esc(response?.reason || '') + '</textarea></label><label class="course-field">' + (node.board.length === 4 ? '如果被跟，河牌准备怎么接？' : '面对对手回应，你准备怎么接？') + '<textarea data-course-draft="plan" rows="2" placeholder="按牌面或对手回应分类，不必预知下一张牌。">' + esc(response?.plan || '') + '</textarea></label><button class="ws-button ws-button--primary" data-course-action="submit">提交判断，查看研究参考</button>') + '</section>') +
      (node.kind === 'decision' ? rangeView(course, node, 1) + rangeView(course, node, 0) : '');
  },
  reviewView(course, round) {
    return Object.entries(round.responses).filter(([, r]) => r.submitted).map(([id, r]) => {
      const n = courseNode(course, id);
      return '<details class="ws-concept" open><summary>' + (n.board.length === 4 ? '转牌' : '河牌') + ' · ' + esc(courseActionLabel(r.choice, n)) + '</summary><p>' + cards(n.board) + '</p><p><strong>当时的理由：</strong>' + esc(r.reason || '未填写') + '</p><p><strong>当时的计划：</strong>' + esc(r.plan || '未填写') + '</p>' + referenceView(course, round, id) + '</details>';
    }).join('');
  },
};
