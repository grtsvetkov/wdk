export const clientConfig = {

};

if (Meteor.isServer) {
    export const serverConfig = {
        HTTPS_redirect_enable: false, //@TODO включить HTTPS редирект
    }
}