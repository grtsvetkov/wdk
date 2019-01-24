let ApplicationController = RouteController.extend({
    onBeforeAction: function () {
        if (Meteor.userId() && this._layout._template == 'AppLayoutPublic') {
            Router.go('index');
        } else if (!Meteor.userId() && this._layout._template == 'AppLayoutPrivate') {
            Router.go('signin');
        }

        if (this.ready()) {
            this.next();
        }
    }
});

Router.configure({
    layoutTemplate: 'AppLayoutPrivate', //AppLayout.html
    notFoundTemplate: 'Error404', //Error404.html
    loadingTemplate: 'Loading', //Loading.html
    controller: ApplicationController
});

Router.route('/', {
    title: 'Рабочая Панель',
    name: 'index',

    /*waitOn: function () {
        return [
            Meteor.subscribe('coin'),
            Meteor.subscribe('wallet'),
        ];
    }*/
});


Router.route('/signin', {
    layoutTemplate: 'AppLayoutPublic',
    title: 'Авторизация',
    name: 'signin'
});

/*
Router.route('/coin/:_id', {
    title: 'Монета',
    name: 'coinItem',
    menu: 'coin',
    waitOn: function () {
        return [
            Meteor.subscribe('coin', 'only_my'),
            Meteor.subscribe('wallet', 'byMyCoin', this.params._id),
            Meteor.subscribe('contact', 'only_my'),
            Meteor.subscribe('request_enroll', 'only_my', this.params._id)
        ];
    }
});
*/