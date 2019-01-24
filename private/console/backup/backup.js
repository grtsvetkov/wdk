#!/usr/bin/env node
//packages: colors, path, fs, cjson, ssh2, moment,

require('colors');

let
    messages = {
        'ARGV2_ERROR': 'укажите в параметре проект для резервного копирования',
        'FILE_NOT_FOUND': 'файл не найден ',
        'SSH_CLIENT_READY': 'Подключение к ssh успешно',

        'FILES': 'файлов',
        'DB': 'БД',

        'ARCHIVE': 'Архив ',
        'TMP_ARCHIVE': 'Временный архив ',

        'REMOVE_TMP_ARCHIVE': 'Удаление временного архива ',
        'REMOVE_SUCC': ' успешно удален',
        'CREATE_ARCHIVE': 'Создание архива ',
        'CREATE_SUCC': ' успешно создан',
        'DOWNLOAD_ARCHIVE': 'Загрузка архива из ',
        'DOWNLOAD_SUCC': ' успешно загружен',
    },
    pathResolve = require('path').resolve,
    errorLog = (message) => {
        console.error(message.red.bold);
        process.exit(1);
    },

    configPath = process.argv[2] ? pathResolve(__dirname + '/config/' + process.argv[2] + '.json') : errorLog(messages.ARGV2_ERROR),
    config = require('fs').existsSync(configPath) ? require('cjson').load(configPath) : errorLog(messages.FILE_NOT_FOUND + configPath),
    sshConn = new require('ssh2').Client(),
    namePrefix = process.argv[2] + require('moment')().format('__DD.MM.YYYY_hh.mm'),
    archiveName_file = namePrefix + '.tar.gz',
    archiveName_mysql = namePrefix + '.sql.gz',
    remoteTmpDir = config.remoteTmp ? config.remoteTmp : '/tmp/',

    removeTmpArchive = (archiveName, desc) => {
        return new Promise((resolve, reject) => {

            console.log(('\t' + messages.REMOVE_TMP_ARCHIVE + desc).bold.blue);

            let cmd = 'rm ' + remoteTmpDir + archiveName;
            console.log('\t' + cmd);

            sshConn.exec(cmd, (err, stream) => {
                if (err) {
                    reject(new Error(err));
                }

                stream.on('close', () => {
                    console.log((messages.TMP_ARCHIVE + desc + messages.REMOVE_SUCC).bold.green);

                    resolve();

                }).on('data', (data) => {
                    //console.log('STDOUT: ' + data);
                }).stderr.on('data', (data) => {
                    reject(new Error(data));
                });
            });
        })
    },
    downloadArchive = (remotePath, localPath, desc) => {
        return new Promise((resolve, reject) => {

            sshConn.sftp(function (err, sftp) {
                if (err) {
                    reject(new Error(err));
                }

                console.log(('\t' + messages.DOWNLOAD_ARCHIVE + remotePath).bold.blue);

                sftp.fastGet(remotePath, localPath, {}, (downloadError) => {

                    if (downloadError) {
                        reject(new Error(downloadError));
                    }

                    console.log((messages.ARCHIVE + desc + messages.DOWNLOAD_SUCC).bold.green);

                    resolve();
                });
            });
        });
    },

    makeArchive = (cmd, desc) => {

        return new Promise((resolve, reject) => {

            console.log(('\t' + messages.CREATE_ARCHIVE + desc).bold.blue);

            console.log('\t' + cmd);

            sshConn.exec(cmd, (err, stream) => {
                if (err) {
                    throw err;
                }

                stream.on('close', () => {
                    console.log((messages.ARCHIVE + desc + messages.CREATE_SUCC).bold.green);

                    resolve();

                }).on('data', (data) => {
                    //console.log('STDOUT: ' + data);
                }).stderr.on('data', (data) => {
                    console.log('\tSTDERR: ' + data);
                });
            })
        });
    };


console.log('---------------------------'.bold.blue);
console.log('RIM WDK BACKUP on:'.bold.blue);
console.log(process.argv[2].bold.blue);
console.log('---------------------------\n'.bold.blue);


try {
    sshConn.on('ready', () => {

        console.log((messages.SSH_CLIENT_READY).bold.green);

        let cmd = 'tar -zcvf ' + remoteTmpDir + archiveName_file + ' -P ' + config.appPath;

        makeArchive(cmd, messages.FILES) //Делаем резеврную копию файлов

            .then(() => { //Скачиваем резервную копию файлов
                let remotePath = remoteTmpDir + archiveName_file,
                    localPath = pathResolve(__dirname + '/archive/' + archiveName_file);

                return downloadArchive(remotePath, localPath, messages.FILES);
            })

            .then(() => removeTmpArchive(archiveName_file, messages.FILES)) //Удаляем временные файлы

            .then(() => { //Создаем дамп БД
                let cmd = 'mysqldump -u ' + config.mysql.user + ' -p' + config.mysql.password + ' ' + config.mysql.database + ' | gzip > ' + remoteTmpDir + archiveName_mysql;
                return makeArchive(cmd, messages.DB);
            })

            .then(() => { //Скачиваем дамп БД

                let remotePath = remoteTmpDir + archiveName_mysql,
                    localPath = pathResolve(__dirname + '/archive/' + archiveName_mysql);

                return downloadArchive(remotePath, localPath, messages.DB);
            })

            .then(() => removeTmpArchive(archiveName_mysql, messages.DB)) //Удаляем временные файлы

            .then(() => { //Закрываем соединение
                sshConn.end();
            })

            .catch(err => { //Отлавливаем ошибки, если будут.
                console.log(err.bold.red);
                sshConn.end();
            });

    })
        .on('error', (err) => { //Ловим ошибки SSHClient`та

            console.log(err);
        })
        .connect(config.ssh); //Соединение по SSH

} catch (err) {
    console.log(err);
    //errorLog(err);
}