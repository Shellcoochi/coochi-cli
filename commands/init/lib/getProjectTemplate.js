const request = require('@coochi/request');

module.exports = function () {
    return request({
        url: 'project/template'
    })
}