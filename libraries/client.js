const crypto = require('crypto');
const axios = require('axios');

module.exports = function(apiKey=null, apiSecret=null) {

    var API_KEY = apiKey;
    var API_SECRET = apiSecret;

    const API_BASE = 'https://api.btcturk.com';

    // PUBLIC ENDPOINTS
    const TICKER_ENDPOINT = '/api/v2/ticker';
    const ORDER_BOOK_ENDPOINT = '/api/v2/orderbook';
    const TRADES_ENDPOINT = '/api/v2/trades';
    const OHLC_ENDPOINT = '/api/v2/ohlc';

    // PRIVATE ENDPOINTS
    const ACCOUNT_BALANCE_ENDPOINT = '/api/v1/users/balances';
    const USER_TRANSACTIONS_ENDPOINT = '/api/v1/users/transactions/trade';
    const OPEN_ORDERS_ENDPOINT = '/api/v1/openOrders';
    const ALL_ORDERS_ENDPOINT = '/api/v1/allOrders';
    const ORDER_ENDPOINT = '/api/v1/order';

    // UTILITY FUNCTIONS

    function _getAuth(url) {

        /*
        * Wrapper function for http GET request
        * Used for making GET requests to 'private' (auth needed) API endpoints
        **/

        return new Promise((resolve, reject) => {
            axios.get(url.toString(), {headers: _getAuthHeaders()})
                .then(res => resolve(res.data.data))
                .catch(err => reject(_constructErrorMessage(url.toString(), err)));
        });
    }

    function _get(url) {

        /*
        * Wrapper function for http GET request
        * Used for making GET requests to 'public' API endpoints
        **/

        return new Promise((resolve, reject) => {
            axios.get(url.toString())
                .then(res => resolve(res.data.data))
                .catch(err => reject(_constructErrorMessage(url.toString(), err)));
        });
    }

    function _post(url, data) {

        // Wrapper function for http POST request

        return new Promise((resolve, reject) => {
            axios.post(url.toString(), data, {headers: _getAuthHeaders()})
                .then(res => resolve(res.data.data))
                .catch(err => reject(_constructErrorMessage(url.toString(), err)));
        });
    }

    function _delete(url) {

        // Wrapper function for http DELETE request

        return new Promise((resolve, reject) => {
            axios.delete(url.toString(), {headers: _getAuthHeaders()})
                .then(res => resolve(res.data))
                .catch(err => reject(_constructErrorMessage(url.toString(), err)));
        })
    }

    function _constructErrorMessage(url, error) {

        // Simplifies the error returned from the server which contains a lot of meta-data

        if (error.response) {
            let code = error.response.status;
            let text = error.response.statusText;
            if (error.response.data && error.response.data.message) text += ' - ' +  error.response.data.message;
            //console.error('Error:', { url, code, text });
            return { url, code, text };
        } else {
            let code = 500;
            let text = 'Unknown error has occurred.';
            //console.error('Error:', { url, code, text });
            return { url, code, text };
        }
    }

    function _getAuthHeaders() {

        /*
        * A 'signature' must be provided within the http headers for endpoints that require authentication
        * This signature depends on the unix time therefore headers have to be updated on each request
        */

        const now = new Date();
        return {
            "X-PCK": API_KEY,
            "X-Stamp": now.getTime().toString(),
            "X-Signature": _getSignature(),
        }
    }

    function _constructURL(pathname) {
        const url = new URL(API_BASE);
        url.pathname = pathname;
        return url;
    }

    function _getSignature() {

        /*
        * Generates a HMAC-SHA256 encoded message for authentication
        *
        * Current unix timestamp is used as cryptographic nonce for creating the signature
        * therefore each time signature is needed it must be re-created*/

        const api_secret_b64_decoded = Buffer.from(API_SECRET, 'base64')
        const stamp = (new Date()).getTime()
        const data = `${API_KEY}${stamp}`
        const data_buffer = Buffer.from(data, 'utf8')
        const signature_buffer = crypto.createHmac('sha256', api_secret_b64_decoded)
        signature_buffer.update(data_buffer)
        const digest = signature_buffer.digest()
        const b64_encoded_signature_buffer = Buffer.from(digest.toString('base64'), 'utf8')
        const signature = b64_encoded_signature_buffer.toString('utf8')
        return signature;
    }

    function _getPairSymbol(pair, del='') {

        /* API requires pairSymbols non-delimited and delimited with '_'  (BTCTRY) and (BTC_TRY)
        * This API client module requires symbols delimited with '-' (BTC-TRY)
        * This function handles the conversion*/

        const numerator = pair.split('-')[0];
        const denominator = pair.split('-')[1];

        return `${numerator}${del}${denominator}`;
    }

    // PUBLIC ENDPOINT IMPLEMENTATIONS

    function getPair(pair) {
        const url = _constructURL(TICKER_ENDPOINT);

        if (pair) {
            const pairSymbol = _getPairSymbol(pair, '_');
            url.searchParams.set('pairSymbol', pairSymbol);
        }
        return _get(url);
    }

    function getOrderBook(pair, count=10) {
        const url = _constructURL(ORDER_BOOK_ENDPOINT);
        const pairSymbol = _getPairSymbol(pair, '_');
        url.searchParams.set('pairSymbol', pairSymbol);
        url.searchParams.set('limit', count.toString());
        return _get(url);
    }

    function getTrades(pair) {
        const url = _constructURL(TRADES_ENDPOINT);
        const pairSymbol = _getPairSymbol(pair, '_');
        url.searchParams.set('pairSymbol', pairSymbol);
        return _get(url);
    }

    function getOHLC(pair, count=10) {
        const url = _constructURL(OHLC_ENDPOINT);
        const pairSymbol = _getPairSymbol(pair, '_');
        url.searchParams.set('pairSymbol', pairSymbol);
        url.searchParams.set('last', count.toString());
        return _get(url);
    }

    // PRIVATE ENDPOINT IMPLEMENTATIONS

    function getAccountBalance(apiKey=null, apiSecret=null) {
        if (apiKey) API_KEY=apiKey;
        if (apiSecret) API_SECRET=apiSecret;
        const url = _constructURL(ACCOUNT_BALANCE_ENDPOINT);
        return _getAuth(url);
    }

    function getTransactions() {
        const url = _constructURL(USER_TRANSACTIONS_ENDPOINT);
        return _getAuth(url);
    }

    function getOpenOrders(pair) {
        const url = _constructURL(OPEN_ORDERS_ENDPOINT);
        const pairSymbol = _getPairSymbol(pair, '_');
        url.searchParams.set('pairSymbol', pairSymbol);
        return _getAuth(url);
    }

    function getAllOrders(pair) {
        const url = _constructURL(ALL_ORDERS_ENDPOINT);
        const pairSymbol = _getPairSymbol(pair, '_');
        url.searchParams.set('pairSymbol', pairSymbol);
        return _getAuth(url);
    }

    function submitMarketOrder(pair, orderType, quantity) {
        const url = _constructURL(ORDER_ENDPOINT);

        const pairSymbol = _getPairSymbol(pair);
        const orderMethod = 'market';

        const data = { quantity, orderMethod, orderType, pairSymbol };

        console.log('Order process detail: ', data);

        let count = 0;
        let trycount = 4;
        let tryms = 2500;
        return new Promise((resolve, reject) => {
            let tx = setInterval(async function() {
                count++;
                try {
                    let response = await _post(url, data);
                    clearInterval(tx);
                    resolve(response);
                } catch (error) {
                    if ((count > trycount) || (error && 400 == error.code))  {
                        clearInterval(tx);
                        reject(error);
                    }
                    else console.log('The order process failed, Retrying...');
                }
            }, tryms);
        });
    }

    function submitLimitOrder(pair, orderType, price, quantity) {
        const url = _constructURL(ORDER_ENDPOINT);

        const pairSymbol = _getPairSymbol(pair);
        const orderMethod = 'limit';

        const data = {
            quantity,
            price,
            orderMethod,
            orderType,
            pairSymbol
        };

        return _post(url, data);
    }

    /*
    function submitStopMarketOrder(pair, orderType, stopPrice, quantity) {
        const url = _constructURL(ORDER_ENDPOINT);

        const pairSymbol = _getPairSymbol(pair);
        const orderMethod = 'stopMarket';

        const data = {
            quantity,
            orderMethod,
            stopPrice,
            orderType,
            pairSymbol,
        };

        return _post(url, data);
    }
    */

    function submitStopLimitOrder(pair, orderType, stopPrice, limitPrice, quantity) {
        const url = _constructURL(ORDER_ENDPOINT);

        const orderMethod = 'stopLimit';
        const pairSymbol = _getPairSymbol(pair);
        const price = limitPrice;

        const data = {
            quantity,
            orderType,
            orderMethod,
            pairSymbol,
            stopPrice,
            price,
        };

        return _post(url, data);
    }

    function cancelOrder(orderId) {
        const url = _constructURL(ORDER_ENDPOINT);
        url.searchParams.set('id', orderId);
        return _delete(url);
    }

    return {
        getPair,
        getOrderBook,
        getTrades,
        getOHLC,
        getAccountBalance,
        getTransactions,
        getOpenOrders,
        getAllOrders,
        submitMarketOrder,
        submitLimitOrder,
        //submitStopMarketOrder,
        submitStopLimitOrder,
        cancelOrder,
    };
}
