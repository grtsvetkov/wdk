Template.signin.events({

    'submit .signin-form': function (e) { //КНОПКА "ВОЙТИ"
        e.preventDefault();

        let data = {
            username: e.target.username.value,
            password: e.target.password.value
        };

        if (data.username.length == 0 || data.password.length == 0) {
            //sAlert.error('Заполните поля "E-mail" и "Пароль"');
            return;
        }

        Meteor.loginWithPassword(e.target.username.value, e.target.password.value, function (err) {
            if (err) {
                if (err.error === 403) {
                    //sAlert.error('Неправильная пара e-mail - пароль! Авторизоваться не удалось. Проверьте раскладку клавиатуры, не нажата ли клавиша "Caps Lock" и попробуйте ввести Вашу почту и пароль еще раз');
                }
            } else {
                Router.go('index');
            }
        });
    }
});