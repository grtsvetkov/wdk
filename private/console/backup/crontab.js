require('colors');

const { exec } = require('child_process');

require('crontab').load((err, crontab) => {
    if (err) {
        return console.error(err);
    }

    crontab.jobs().forEach((job) => {
        console.log(job.toString());
    });

    crontab.save((err, crontab) =>{ });
});

