import {serverConfig} from '../lib/config';

Meteor.startup(() => {

    if (serverConfig.HTTPS_redirect_enable) {

        let httpServer = WebApp.httpServer,
            url = Npm.require('url'),
            isPrivateAddr = addr => ((/^\s*(127\.0\.0\.1|::1)\s*$/.test(addr)) || (/^\s*(192\.168\.\d+\.\d+)\s*$/.test(addr))) ? true : false;

        httpServer.removeAllListeners('request');

        httpServer.addListener('request', function (req, res) {
            let args = arguments;

            if (
                !( //IF NOT
                    isPrivateAddr((req.connection.remoteAddress || req.socket.remoteAddress))
                    && (!req.headers['x-forwarded-for'] || _.all(req.headers['x-forwarded-for'].split(','), x => isPrivateAddr(x)))

                )
                && !( //AND NOT
                    req.connection.pair
                    || (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'].indexOf('https') !== -1)

                )) { //THEN

                res.writeHead(302, {Location: 'https://' + url.parse(Meteor.absoluteUrl()).hostname.replace(/:\d+$/, '') + req.url});
                res.end();
                return;
            }

            _.each(httpServer.listeners('request').slice(0), oldListener => oldListener.apply(httpServer, args));
        });
    }

    WebApp.rawConnectHandlers.use(function (req, res, next) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return next();
    });


    if (Meteor.users.find().count() == 0) {

        //Создаем пользователя Администратор
        Accounts.createUser({
            username: 'admin',
            password: 'dtybr11',
            profile: {
                name: 'Administrator',
                role: 'admin',
            }
        });

    }
});