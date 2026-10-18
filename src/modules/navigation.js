// [V7.7.2 新增] Review 导航 intent module：调用方表达目标，统一处理 Tab、渲染和定位。
var _handlers = {
  onTab: function () {},
  onSubtab: function () {},
  onTargetHand: function () {},
  onTargetSession: function () {},
  onLearningTarget: function () {},
  onTargetStrategy: function () {},  // [V7.10.1 新增]
  onTargetOpponent: function () {},  // [V7.10.2 新增]
  onRefresh: function () {},
};

function _activateMainTab(tab) {
  var workspace = ['analyze', 'study', 'practice'].includes(tab);
  var button = document.querySelector('.nav__btn[data-tab="' + (workspace ? 'workbench' : tab) + '"]');
  var panel = document.getElementById(tab + 'Panel');
  var main = document.querySelector('.main');
  if (!button || !panel || !main) return false;
  document.querySelectorAll('.nav__btn').forEach(function (item) {
    item.classList.toggle('nav__btn--active', item === button);
    if (item === button) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
  });
  main.setAttribute('data-active-tab', tab);
  document.querySelectorAll('.panel').forEach(function (item) {
    item.classList.remove('is-visible');
  });
  panel.classList.add('is-visible');
  var workbench = document.getElementById('decisionWorkbench');
  if (workbench) workbench.hidden = !workspace;
  return true;
}

function _activateReviewSubtab(name) {
  var button = document.querySelector('#reviewSubNav .subnav__btn[data-sub="' + name + '"]');
  var panelId = 'sub' + name.charAt(0).toUpperCase() + name.slice(1);
  var panel = document.getElementById(panelId);
  if (!button || !panel) return false;
  document.querySelectorAll('#reviewSubNav .subnav__btn').forEach(function (item) {
    item.classList.toggle('subnav__btn--active', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  document.querySelectorAll('#reviewPanel .sub-panel').forEach(function (item) {
    item.classList.remove('is-visible');
  });
  panel.classList.add('is-visible');
  return true;
}

export const Navigation = {
  lastWorkbenchTab: 'analyze',
  viewportPositions: {},
  configure(options) {
    var opts = options || {};
    _handlers = {
      onTab: opts.onTab || function () {},
      onSubtab: opts.onSubtab || function () {},
      onTargetHand: opts.onTargetHand || function () {},
      onTargetSession: opts.onTargetSession || function () {},
      onLearningTarget: opts.onLearningTarget || function () {},
      onTargetStrategy: opts.onTargetStrategy || function () {},  // [V7.10.1 新增]
      onTargetOpponent: opts.onTargetOpponent || function () {},  // [V7.10.2 新增]
      onRefresh: opts.onRefresh || function () {},
    };
  },

  bindNav() {
    var nav = document.querySelector('.nav');
    if (!nav || nav.dataset.navigationBound === 'true') return;
    nav.dataset.navigationBound = 'true';
    nav.addEventListener('click', function (event) {
      var button = event.target.closest('.nav__btn');
      if (button) Navigation.goToTab(button.dataset.tab);
    });
  },

  bindSubNav() {
    var nav = document.getElementById('reviewSubNav');
    if (!nav || nav.dataset.navigationBound === 'true') return;
    nav.dataset.navigationBound = 'true';
    nav.addEventListener('click', function (event) {
      var button = event.target.closest('.subnav__btn');
      if (button) Navigation.goToReviewSubtab(button.dataset.sub);
    });
  },

  goToTab(tab) {
    if (tab === 'workbench') tab = this.lastWorkbenchTab;
    const previous = document.querySelector('.main')?.dataset.activeTab;
    if (previous) this.viewportPositions[previous] = window.scrollY;
    if (!_activateMainTab(tab)) return false;
    if (['analyze', 'study', 'practice'].includes(tab)) this.lastWorkbenchTab = tab;
    _handlers.onTab(tab);
    if (previous !== tab) window.scrollTo({ top: this.viewportPositions[tab] || 0, behavior: 'instant' });
    return true;
  },

  goToReviewSubtab(name, options) {
    if (!this.goToTab('review') || !_activateReviewSubtab(name)) return false;
    _handlers.onSubtab(name, options || {});
    return true;
  },

  goToHand(handId, context = null) {
    if (!this.goToTab('analyze')) return false;
    _handlers.onTargetHand(handId, context);
    return true;
  },

  goToSession(sessionId) {
    if (!this.goToReviewSubtab('session')) return false;
    _handlers.onTargetSession(sessionId);
    return true;
  },

  goToLearningTarget(target) {
    if (!target) return false;
    _handlers.onLearningTarget(target);
    return true;
  },

  goToStrategy(strategyId) {
    // [V7.10.1 新增] 策略域 deep-link
    if (!this.goToReviewSubtab('strategy')) return false;
    _handlers.onTargetStrategy(strategyId);
    return true;
  },

  goToOpponent(oHash) {
    // [V7.10.2 新增] 对手上下文 deep-link
    if (!this.goToReviewSubtab('opponent')) return false;
    _handlers.onTargetOpponent(oHash);
    return true;
  },

  refreshReview(scope) {
    _handlers.onRefresh(scope || 'all');
  },
};
