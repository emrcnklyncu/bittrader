$(document).ready(function () {
  function now() {
    $('#time').html(timeToDate(new Date().getTime(), true));
  };
  setInterval(now, 1000);
});
