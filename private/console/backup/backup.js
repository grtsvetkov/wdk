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
    localPath = pathResolve(__dirname + '/archive') + '/',
    remoteTmpDir = config.remoteTmp ? config.remoteTmp : '/tmp/',


    execCmd = (cmd, descBefore, descAfter, stopOnErrorFlag) => new Promise((resolve, reject) => {

        if (descBefore) {
            console.log(descBefore);
        }
        console.log('\t' + cmd);

        sshConn.exec(cmd, (err, stream) => {
            if (err) {
                reject(new Error(err));
            }

            stream.on('close', () => {

                if (descAfter) {
                    console.log(descAfter);
                }

                resolve();

            }).on('data', (data) => {
                //console.log('STDOUT: ' + data);
            }).stderr.on('data', (data) => {
                if (stopOnErrorFlag) {
                    reject(new Error(data));
                } else {
                    console.log('\tSTDERR: ' + data);
                }
            });
        });

    }),

    removeTmpArchive = (archiveName, desc) => new Promise((resolve, reject) => {
        execCmd(
            ('rm ' + remoteTmpDir + archiveName), //cmd
            ('\t' + messages.REMOVE_TMP_ARCHIVE + desc).bold.blue, //descBefore
            (messages.TMP_ARCHIVE + desc + messages.REMOVE_SUCC).bold.green, //descAfter
            true //stopOnErrorFlag
        ).then(resolve).catch(err => reject(err));
    }),

    downloadArchive = (remotePath, localPath, desc) => new Promise((resolve, reject) => {

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
    }),

    makeArchive = (cmd, desc) => new Promise((resolve, reject) => {
        execCmd(
            cmd, //cmd
            ('\t' + messages.CREATE_ARCHIVE + desc).bold.blue, //descBefore
            (messages.ARCHIVE + desc + messages.CREATE_SUCC).bold.green, //descAfter
            false //stopOnErrorFlag
        ).then(resolve).catch(err => reject(err));
    });


console.log('---------------------------'.bold.blue);
console.log('RIM WDK BACKUP on:'.bold.blue);
console.log(process.argv[2].bold.blue);
console.log('---------------------------\n'.bold.blue);


try {
    sshConn.on('ready', () => {

        console.log((messages.SSH_CLIENT_READY).bold.green);


        let beforePromise = new Promise((resolve) => resolve());

        if (config.beforeCmd) {
            beforePromise = execCmd(config.beforeCmd, 'before cmd'.bold.yellow);
        }

        beforePromise
            .then(() => { //Делаем резеврную копию файлов

                let cmd = 'tar -zcvf ' + remoteTmpDir + archiveName_file;

                if (config.archiveIgnoreFolders) {
                    config.archiveIgnoreFolders.forEach((folder) => {
                        cmd += ' --exclude=' + config.appPath + folder;
                    })
                }

                cmd += ' -P ' + config.appPath;

                return makeArchive(cmd, messages.FILES);
            })

            //Скачиваем резервную копию файлов
            .then(() => downloadArchive((remoteTmpDir + archiveName_file), (localPath + archiveName_file), messages.FILES))

            //Удаляем временные файлы
            .then(() => removeTmpArchive(archiveName_file, messages.FILES))

            //Создаем дамп БД
            .then(() => {

                if (!config.mysql || !config.mysql.database || !config.mysql.user || !config.mysql.password) {
                    throw 'end_of_steps';
                }

                let cmd = 'mysqldump -u ' + config.mysql.user + ' -p' + config.mysql.password + ' ' + config.mysql.database + ' | gzip > ' + remoteTmpDir + archiveName_mysql;
                return makeArchive(cmd, messages.DB);
            })

            //Скачиваем дамп БД
            .then(() => downloadArchive((remoteTmpDir + archiveName_mysql), (localPath + archiveName_mysql), messages.DB))

            //Удаляем временные файлы
            .then(() => removeTmpArchive(archiveName_mysql, messages.DB))

            .then(() => { //Закрываем соединение
                sshConn.end();
            })

            .catch(err => { //Отлавливаем ошибки, если будут.

                if (err != 'end_of_steps') {
                    console.log(err);
                }

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