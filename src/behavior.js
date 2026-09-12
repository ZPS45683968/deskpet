// Shared by the desktop renderer and time-boundary tests.
(function (root) {
  const dailyActions = ['walk', 'sit', 'wave', 'jump', 'inspect', 'badminton', 'soccer', 'basketball', 'weights', 'singing', 'pingpong', 'coffee'];
  function chooseBehavior(date = new Date(), random = Math.random) {
    const overtimeWeight = date.getHours() >= 18 ? 5 : 1;
    const index = Math.floor(random() * (dailyActions.length + overtimeWeight));
    return dailyActions[index] || 'overtime';
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { chooseBehavior };
  else root.zhubaoBehavior = { chooseBehavior };
})(globalThis);

