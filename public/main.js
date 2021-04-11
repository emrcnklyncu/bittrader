$(document).ready(function () {
  function timeToDate(time, flag = false) {
    var date = new Date(time);

    var day = '0' + date.getDate();
    var month = '0' + (date.getMonth() + 1);
    var year = date.getFullYear();
    var hours = '0' + date.getHours();
    var minutes = '0' + date.getMinutes();
    var seconds = '0' + date.getSeconds();

    if (flag)
      // Will display time in 10:30:23 format
      return hours.substr(-2) + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
    else
      // Will display time in 04/11/2020 10:30:23 format
      return day.substr(-2) + '/' + month.substr(-2) + '/' + year + ' ' + hours.substr(-2) + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
  };
  function now() {
    $('#time').html(timeToDate(new Date().getTime(), true));
  };
  now();
  setInterval(now, 1000);
});
