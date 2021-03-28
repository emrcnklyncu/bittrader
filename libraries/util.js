module.exports = function() {

  function timeToDate(time, flag = false) {
    var date = new Date(time);

    var day = '0' + date.getDate();
    var month = '0' + date.getMonth();
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

  function formatMoney(amount, decimalCount = 2, decimal = '.', thousands = ',') {
    try {
      decimalCount = Math.abs(decimalCount);
      decimalCount = isNaN(decimalCount) ? 2 : decimalCount;

      const negativeSign = amount < 0 ? '-' : '';

      let i = parseInt(amount = Math.abs(Number(amount) || 0).toFixed(decimalCount)).toString();
      let j = (i.length > 3) ? i.length % 3 : 0;

      return negativeSign + (j ? i.substr(0, j) + thousands : '') + i.substr(j).replace(/(\d{3})(?=\d)/g, '$1' + thousands) + (decimalCount ? decimal + Math.abs(amount - i).toFixed(decimalCount).slice(2) : '');
    } catch (error) {
      console.error(`${chalk.red.bold('error: ', error)}`);
    }
  };

  function padRight(str, max, c) {
    var self = str;
    return self + new Array(Math.max(0, max - self.length + 1)).join(c || ' ');
  };

  function padLeft(str, max, c) {
    var self = str;
    return new Array(Math.max(0, max - self.length + 1)).join(c || ' ') + self;
  };

  function padCenter(str, max, c) {
    var self = str;
    var e = Math.floor((max - self.length + 1) / 2);
    return new Array(Math.max(0, e)).join(c || ' ') + self + new Array(Math.max(0, e)).join(c || ' ');
  };

  function arrayToObject(array) {
    var output = {};
    for (i in array) {
      item = array[i];
      for (const [key, value] of Object.entries(item)) {
        if (output[key]) {
          output[key] = output[key].concat(item[key]);
        } else {
          output[key] = [item[key]];
        }
      }
    };
    return output;
  };
  function isValidTimeZone(tz) {
    if (!Intl || !Intl.DateTimeFormat().resolvedOptions().timeZone) {
      return false
    }
    try {
      Intl.DateTimeFormat(undefined, {timeZone: tz});
      return true;
    }
    catch (ex) {
      return false;
    }
  };

  return {
    timeToDate,
    formatMoney,
    padRight,
    padLeft,
    padCenter,
    arrayToObject,
    isValidTimeZone
  };
}
