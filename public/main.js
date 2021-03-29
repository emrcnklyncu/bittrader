$(document).ready(function () {
  setInterval(function() {
    refreshDashboard();
  }, 60 * 1000);//1 minute
  async function refreshDashboard() {
    try {
      const res = await axios.get('/ajax');
      if (res.data) { 
        $('#main').html(res.data);
      }
    } catch (error) {
      console.error(error);
    }
  };
});
