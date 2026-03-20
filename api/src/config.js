const fss = require('fs');
const Logger = require('logplease');
const logger = Logger.create('config');

const options = {
    log_level: {
        default: 'INFO',
        validators: [x => Object.values(Logger.LogLevels).includes(x) || `Log level ${x} does not exist`],
    },
    bind_address: {
        default: `0.0.0.0:${process.env['PORT'] || 2000}`,
        validators: [],
    },
    data_directory: {
        default: '/compiler',
        validators: [x => fss.existsSync(x) || `Directory ${x} does not exist`],
    },
    runner_uid_min: { default: 1001, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    runner_uid_max: { default: 1500, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    runner_gid_min: { default: 1001, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    runner_gid_max: { default: 1500, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    disable_networking: { default: true, parser: x => x === 'true', validators: [x => typeof x === 'boolean'] },
    
    // Natija hajmini 50 MB ga oshirdik (OL xatosini oldini olish uchun)
    output_max_size: { default: 52428800, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    
    max_process_count: { default: 64, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    max_open_files: { default: 2048, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    max_file_size: { default: 10000000, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    
    // Vaqt limitlarini 2 daqiqaga oshirdik (TO xatosini oldini olish uchun)
    compile_timeout: { default: 120000, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    run_timeout: { default: 120000, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    compile_cpu_time: { default: 120000, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    run_cpu_time: { default: 120000, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    
    // RAM limitini 2 GB ga oshirdik (137 xatosini kamaytirish uchun)
    // Diqqat: Bu serveringizdagi RAM miqdoridan oshib ketmasligi kerak!
    compile_memory_limit: { default: 2147483648, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    run_memory_limit: { default: 2147483648, parser: parseInt, validators: [(x, raw) => !isNaN(x)] },
    
    repo_url: { default: 'https://github.com/shoyim/compiler/releases/download/pkgs/index', validators: [] },
    max_concurrent_jobs: { default: 64, parser: parseInt, validators: [x => x > 0] },
    limit_overrides: { default: {}, parser: parse_overrides, validators: [x => !!x, validate_overrides] },
};

Object.freeze(options);

function apply_validators(validators, params) {
    for (const v of validators) {
        const res = v(...params);
        if (res !== true) return res;
    }
    return true;
}

function parse_overrides(str) {
    try {
        const obj = JSON.parse(str);
        const parsed = {};
        const keys = ['max_process_count', 'max_open_files', 'max_file_size', 'compile_memory_limit', 'run_memory_limit', 'compile_timeout', 'run_timeout', 'compile_cpu_time', 'run_cpu_time', 'output_max_size'];
        for (const lang in obj) {
            parsed[lang] = {};
            for (const k in obj[lang]) {
                if (!keys.includes(k)) return null;
                parsed[lang][k] = options[k].parser(obj[lang][k]);
            }
        }
        return parsed;
    } catch { return null; }
}

function validate_overrides(overrides) {
    for (const lang in overrides) {
        for (const k in overrides[lang]) {
            const res = apply_validators(options[k].validators, [overrides[lang][k], overrides[lang][k]]);
            if (res !== true) return res;
        }
    }
    return true;
}

let config = {};
for (const name in options) {
    const opt = options[name];
    const env_key = 'COMPILER_' + name.toUpperCase();
    const env_val = process.env[env_key];
    const val = env_val === undefined ? opt.default : (opt.parser ? opt.parser(env_val) : env_val);
    const res = apply_validators(opt.validators, env_val === undefined ? [val, val] : [val, env_val]);
    if (res !== true) {
        logger.error(`Config ${name} failed:`, res);
        process.exit(1);
    }
    config[name] = val;
}

module.exports = config;