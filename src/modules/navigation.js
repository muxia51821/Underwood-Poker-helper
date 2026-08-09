// [V7.7.2 新增] Review 导航 intent module：调用方表达目标，统一处理 Tab、渲染和定位。
var _handlers = {
  onTab: function () {},
  onSubtab: function () {},
  onTargetHand: function () {},
  onTargetSession: function () {},
  onLearningTarget: function () {},
  onRefresh: function () {},
};

function _activateMainTab(tab) {
  var button = document.querySelector('.nav__btn[data-tab="' + tab + '"]');
  var panel = document.getElementById(tab + 'Panel');
  var main = document.querySelector('.main');
  if (!button || !panel || !main) return false;
  document.querySelectorAll('.nav__btn').forEach(function (item) {
    item.classList.toggle('nav__btn--active', item === button);
  });
  main.setAttribute('data-active-tab', tab);
  document.querySelectorAll('.panel').forEach(function (item) {
    item.classList.remove('is-visible');
  });
  panel.classList.add('is-visible');
  return true;
}

function _activateReviewSubtab(name) {
  var button = document.querySelector('#reviewSubNav .subnav__btn[data-sub="' + name + '"]');
  var panelId = 'sub' + name.charAt(0).toUpperCase() + name.slice(1);
  var panel = document.getElementById(panelId);
  if (!button || !panel) return false;
  document.querySelectorAll('#reviewSubNav .subnav__btn').forEach(function (item) {
    item.classList.toggle('subnav__btn--active', item === button);
  });
  document.querySelectorAll('#reviewPanel .sub-panel').forEach(function (item) {
    item.classList.remove('is-visible');
  });
  panel.classList.add('is-visible');
  return true;
}

export const Navigation = {
  configure(options) {
    var opts = options || {};
    _handlers = {
      onTab: opts.onTab || function () {},
      onSubtab: opts.onSubtab || function () {},
      onTargetHand: opts.onTargetHand || function () {},
      onTargetSession: opts.onTargetSession || function () {},
      onLearningTarget: opts.onLearningTarget || function () {},
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
    if (!_activateMainTab(tab)) return false;
    _handlers.onTab(tab);
    return true;
  },

  goToReviewSubtab(name, options) {
    if (!this.goToTab('review') || !_activateReviewSubtab(name)) return false;
    _handlers.onSubtab(name, options || {});
    return true;
  },

  goToHand(handId) {
    if (!this.goToReviewSubtab('hand', { resetPage: true })) return false;
    _handlers.onTargetHand(handId);
    return true;
  },

  goToSession(sessionId) {
    if (!this.goToReviewSubtab('session')) return false;
    _handlers.onTargetSession(sessionId);
    return true;
  },

  goToLearningTarget(target) {
    var moved = this.goToReviewSubtab('discover', { learningTarget: target });
    if (moved) _handlers.onLearningTarget(target);
    return moved;
  },

  refreshReview(scope) {
    _handlers.onRefresh(scope || 'all');
  },
};
