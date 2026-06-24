#!/usr/bin/env node

/**
 * Script de Deploy Local para KingHost
 * Executa build e upload via FTP da sua máquina (IP nacional)
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deployTarViaSshPassword, tarExcludeShellFlags } from './lib/ssh-deploy.js';

// Tentar importar basic-ftp (opcional)
let ftp;
try {
  const ftpModule = await import('basic-ftp');
  ftp = ftpModule.default || ftpModule;
} catch (e) {
  // basic-ftp não instalado - continuar sem upload automático
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Carregar variáveis de ambiente
function loadEnv() {
  const envPath = join(rootDir, '.env.production');
  if (!existsSync(envPath)) {
    log('⚠️  Arquivo .env.production não encontrado!', 'yellow');
    log('📝 Criando .env.production com valores padrão...', 'yellow');
    return {
      VITE_API_BASE_URL: 'https://www.netcarmultimarcas.com.br/api/v1',
      VITE_SOCIAL_API_BASE_URL: 'https://www.netcarmultimarcas.com.br/social/v1',
      VITE_USE_NETCAR_SOCIAL: 'true',
      VITE_API_TIMEOUT: '30000',
      VITE_BASE_PATH: '/',
    };
  }

  const envContent = readFileSync(envPath, 'utf-8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  return env;
}

// Obter informações do último commit do projeto principal
function getLastCommitInfo() {
  try {
    const commitHash = execSync('git rev-parse --short HEAD', { 
      encoding: 'utf-8', 
      cwd: rootDir 
    }).trim();
    
    const commitMessage = execSync('git log -1 --pretty=%B', { 
      encoding: 'utf-8', 
      cwd: rootDir 
    }).trim().split('\n')[0]; // Pegar apenas a primeira linha
    
    return { hash: commitHash, message: commitMessage };
  } catch (error) {
    // Se não for um repositório git ou houver erro, usar valores padrão
    return { 
      hash: 'unknown', 
      message: 'Build sem commit associado' 
    };
  }
}

// Inicializar e fazer commit no repositório Git da pasta dist
function commitDistBuild(distPath) {
  try {
    const gitDir = join(distPath, '.git');
    const isGitRepo = existsSync(gitDir);
    
    if (!isGitRepo) {
      log('📦 Inicializando repositório Git na pasta dist...', 'blue');
      execSync('git init', { cwd: distPath, stdio: 'pipe' });
      
      // Criar .gitignore na pasta dist para ignorar arquivos temporários
      const gitignoreContent = `# Arquivos temporários
*.tmp
*.log
.DS_Store
Thumbs.db
`;
      writeFileSync(join(distPath, '.gitignore'), gitignoreContent);
      log('✅ Repositório Git inicializado', 'green');
    }
    
    // Obter informações do commit do projeto principal
    const commitInfo = getLastCommitInfo();
    const commitMessage = `build: ${commitInfo.message} / ${commitInfo.hash}`;
    
    log('📝 Registrando build no Git...', 'blue');
    log(`   Commit: ${commitMessage}`, 'blue');
    
    // Adicionar todos os arquivos
    execSync('git add -A', { cwd: distPath, stdio: 'pipe' });
    
    // Verificar se há mudanças para commitar
    try {
      const status = execSync('git status --porcelain', { 
        encoding: 'utf-8', 
        cwd: distPath 
      });
      
      if (status.trim()) {
        // Configurar usuário Git se não estiver configurado (apenas para este repo)
        try {
          execSync('git config user.name "Build System"', { 
            cwd: distPath, 
            stdio: 'pipe' 
          });
          execSync('git config user.email "build@netcar.com.br"', { 
            cwd: distPath, 
            stdio: 'pipe' 
          });
        } catch (e) {
          // Ignorar erro se já estiver configurado
        }
        
        // Fazer commit (usar arquivo temporário para evitar problemas com caracteres especiais)
        const commitMsgFile = join(distPath, '.git-commit-msg.txt');
        try {
          writeFileSync(commitMsgFile, commitMessage, 'utf-8');
          execSync(`git commit -F .git-commit-msg.txt`, { 
            cwd: distPath, 
            stdio: 'pipe' 
          });
          unlinkSync(commitMsgFile);
        } catch (commitError) {
          // Tentar remover arquivo temporário mesmo em caso de erro
          try {
            if (existsSync(commitMsgFile)) unlinkSync(commitMsgFile);
          } catch (e) {}
          throw commitError;
        }
        log('✅ Build registrado no Git', 'green');
      } else {
        log('ℹ️  Nenhuma mudança detectada no build', 'blue');
      }
    } catch (statusError) {
      log('⚠️  Não foi possível verificar status do Git', 'yellow');
    }
    
  } catch (error) {
    log(`⚠️  Erro ao registrar build no Git: ${error.message}`, 'yellow');
    log('   Continuando com o deploy...', 'yellow');
  }
}

// Carregar configurações FTP / SSH
function loadDeployConfig() {
  let config = {
    method: (process.env.DEPLOY_METHOD || 'ftp').toLowerCase(),
    ftp: {
      server: process.env.FTP_SERVER || '',
      username: process.env.FTP_USERNAME || '',
      password: process.env.FTP_PASSWORD || '',
      serverDir: process.env.FTP_SERVER_DIR || '/www/',
      secure: process.env.FTP_SECURE === 'true',
    },
    ssh: {
      host: process.env.SSH_HOST || 'netcarmultimarcas.com.br',
      user: process.env.SSH_USER || '',
      remoteDir: process.env.SSH_DIR || 'www/',
      password: process.env.SSH_PASSWORD || '',
      identityFile: process.env.SSH_KEY_PATH || '',
    },
  };

  const envLocalPath = join(rootDir, '.env.local');
  if (existsSync(envLocalPath)) {
    const envContent = readFileSync(envLocalPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        if (key === 'DEPLOY_METHOD') config.method = value.toLowerCase();
        if (key === 'FTP_SERVER') config.ftp.server = value;
        if (key === 'FTP_USERNAME') config.ftp.username = value;
        if (key === 'FTP_PASSWORD') config.ftp.password = value;
        if (key === 'FTP_SERVER_DIR') config.ftp.serverDir = value;
        if (key === 'FTP_SECURE') config.ftp.secure = value === 'true';
        if (key === 'SSH_HOST') config.ssh.host = value;
        if (key === 'SSH_USER') config.ssh.user = value;
        if (key === 'SSH_DIR') config.ssh.remoteDir = value;
        if (key === 'SSH_PASSWORD') config.ssh.password = value;
        if (key === 'SSH_KEY_PATH') config.ssh.identityFile = value;
      }
    });
  }

  if (config.method === 'ssh') {
    if (!config.ssh.user) {
      config.ssh.user = config.ftp.username;
    }
    if (!config.ssh.user) {
      log('❌ SSH: configure SSH_USER ou FTP_USERNAME no .env.local', 'red');
      process.exit(1);
    }
    return config;
  }

  if (!config.ftp.server || !config.ftp.username || !config.ftp.password) {
    log('❌ Configuração FTP não encontrada!', 'red');
    log('\n📋 Crie um arquivo .env.local na raiz do projeto com:', 'yellow');
    log('   DEPLOY_METHOD=ssh   # recomendado (você já tem SSH na KingHost)', 'yellow');
    log('   SSH_USER=netcarmultimarcas', 'yellow');
    log('   SSH_DIR=www/', 'yellow');
    log('\n   Ou FTP:', 'yellow');
    log('   FTP_SERVER=ftp.seusite.com.br', 'yellow');
    log('   FTP_USERNAME=seu_usuario', 'yellow');
    log('   FTP_PASSWORD=sua_senha', 'yellow');
    log('   FTP_SERVER_DIR=/www/', 'yellow');
    process.exit(1);
  }

  return config;
}

/** @deprecated use loadDeployConfig */
function loadFTPConfig() {
  return loadDeployConfig().ftp;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFtpConnectionError(error) {
  const message = String(error?.message || error).toLowerCase();
  return (
    message.includes('econnreset') ||
    message.includes('client is closed') ||
    message.includes('etimedout') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('broken pipe') ||
    message.includes('socket hang up')
  );
}

function createFtpClient() {
  // allowSeparateTransferHost: false = usa IP do controle no PASV (igual FileZilla)
  // Corrige ECONNRESET quando o servidor devolve IP interno na porta de dados
  const client = new ftp.Client(120000, { allowSeparateTransferHost: false });
  client.ftp.verbose = false;
  client.ftp.ipFamily = 4;
  return client;
}

async function connectFtp(client, ftpConfig) {
  await client.access({
    host: ftpConfig.server,
    user: ftpConfig.username,
    password: ftpConfig.password,
    secure: ftpConfig.secure ? true : false,
  });

  const remoteDir = ftpConfig.serverDir.replace(/\/$/, '') || '/www';
  try {
    await client.cd(remoteDir);
  } catch {
    await client.ensureDir(remoteDir);
    await client.cd(remoteDir);
  }
}

async function reconnectFtp(ftpConfig) {
  const client = createFtpClient();
  await connectFtp(client, ftpConfig);
  return client;
}

async function uploadDistFiles(initialClient, ftpConfig, distPath, allFiles) {
  let client = initialClient;
  let uploadedCount = 0;
  const failedFiles = [];
  const totalFiles = allFiles.length;

  log('📤 Fazendo upload dos arquivos (FTP)...', 'blue');
  log('   Modo passivo: IP do servidor de controle (compatível com KingHost)', 'yellow');

  for (const filePath of allFiles) {
    let relativePath = filePath.replace(distPath, '').replace(/\\/g, '/');
    if (relativePath.startsWith('/')) {
      relativePath = relativePath.substring(1);
    }
    relativePath = relativePath.replace(/^[A-Z]:\/?/i, '').replace(/^[A-Z]:\\/i, '');

    if (relativePath.includes('C:\\') || relativePath.includes('C:/') || relativePath.includes('wamp64')) {
      log(`   ⚠️  Ignorando arquivo com caminho inválido: ${relativePath}`, 'yellow');
      continue;
    }

    const dirPath = relativePath.split('/').slice(0, -1).join('/');
    let retries = 5;
    let uploaded = false;

    while (retries > 0 && !uploaded) {
      try {
        if (dirPath) {
          await client.ensureDir(dirPath);
        }
        await client.uploadFrom(filePath, relativePath);
        uploaded = true;
        uploadedCount++;

        if (uploadedCount % 10 === 0 || uploadedCount === totalFiles) {
          log(
            `   Progresso: ${uploadedCount}/${totalFiles} arquivos (${Math.round((uploadedCount / totalFiles) * 100)}%)`,
            'blue'
          );
        }

        // Pausa leve — evita o KingHost derrubar a conexão em rajada
        await sleep(50);
      } catch (fileError) {
        retries--;
        const attempt = 5 - retries;

        if (retries > 0 && isFtpConnectionError(fileError)) {
          const waitMs = Math.min(2000 * attempt, 10000);
          log(
            `   ⚠️  Conexão FTP caiu em ${relativePath} — nova sessão (${retries} tentativas restantes)...`,
            'yellow'
          );
          try {
            client.close();
          } catch {
            // ignore
          }
          await sleep(waitMs);
          client = await reconnectFtp(ftpConfig);
          continue;
        }

        if (retries > 0) {
          log(
            `   ⚠️  Erro em ${relativePath}, tentando novamente... (${retries} restantes)`,
            'yellow'
          );
          await sleep(1000 * attempt);
          continue;
        }

        log(`   ❌ Falha ao fazer upload de ${relativePath}: ${fileError.message}`, 'red');
        failedFiles.push(relativePath);
      }
    }
  }

  return { uploadedCount, failedFiles, totalFiles, client };
}

function shellQuote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function hasCommand(command) {
  try {
    execSync(`command -v ${command}`, { stdio: 'pipe', shell: true });
    return true;
  } catch {
    return false;
  }
}

function resolveSshIdentityFile(sshConfig) {
  if (sshConfig.identityFile && existsSync(sshConfig.identityFile)) {
    return sshConfig.identityFile;
  }

  const defaults = ['id_ed25519', 'id_rsa'].map((name) => join(homedir(), '.ssh', name));
  return defaults.find((path) => existsSync(path)) || '';
}

function resolveSshDeployMode(sshConfig) {
  const identityFile = resolveSshIdentityFile(sshConfig);
  const hasPassword = Boolean(sshConfig.password);
  const hasSshpass = hasCommand('sshpass');

  if (hasPassword && !hasSshpass) {
    return { mode: 'ssh2', identityFile };
  }
  if (hasPassword && hasSshpass) {
    return { mode: 'sshpass', identityFile };
  }
  if (identityFile) {
    return { mode: 'key', identityFile };
  }
  return { mode: 'interactive', identityFile: '' };
}

function buildSshInvocation(sshConfig, remote, remoteCommand) {
  const { mode, identityFile } = resolveSshDeployMode(sshConfig);
  const sshOptions = ['-o StrictHostKeyChecking=accept-new'];

  if (identityFile && mode !== 'ssh2') {
    sshOptions.push(`-i ${shellQuote(toPosixPath(identityFile))}`, '-o IdentitiesOnly=yes');
  }

  const sshTarget = `${remote} ${shellQuote(remoteCommand)}`;
  const sshBase = `ssh ${sshOptions.join(' ')} ${sshTarget}`;

  if (mode === 'sshpass') {
    return {
      command: `sshpass -e ${sshBase}`,
      env: { SSHPASS: sshConfig.password },
      mode,
    };
  }

  if (mode === 'key') {
    return { command: sshBase, env: {}, mode };
  }

  if (mode === 'ssh2') {
    return { command: '', env: {}, mode };
  }

  return { command: sshBase, env: {}, mode: 'interactive' };
}

function toPosixPath(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');
  const driveMatch = normalized.match(/^([A-Za-z]):\//);
  if (driveMatch) {
    return `/${driveMatch[1].toLowerCase()}${normalized.slice(2)}`;
  }
  return normalized;
}

function commitBlogAutoIfChanged() {
  const blogRelPath = 'src/data/seo/blog-auto.json';
  const blogPath = join(rootDir, blogRelPath);

  if (!existsSync(blogPath)) {
    return;
  }

  try {
    const status = execSync(`git status --porcelain -- ${blogRelPath}`, {
      encoding: 'utf-8',
      cwd: rootDir,
      stdio: 'pipe',
    }).trim();

    if (!status) {
      return;
    }

    execSync(`git add -- ${blogRelPath}`, { cwd: rootDir, stdio: 'pipe' });

    const date = new Date().toISOString().slice(0, 10);
    const commitMessage = `chore(blog): rodada weekly ${date}`;
    const commitMsgFile = join(rootDir, '.git-commit-msg.txt');

    try {
      writeFileSync(commitMsgFile, commitMessage, 'utf-8');
      execSync('git commit -F .git-commit-msg.txt', { cwd: rootDir, stdio: 'pipe' });
      unlinkSync(commitMsgFile);
      log(`📝 blog-auto.json commitado (${commitMessage})`, 'green');
    } catch (commitError) {
      try {
        if (existsSync(commitMsgFile)) unlinkSync(commitMsgFile);
      } catch (e) {}
      throw commitError;
    }
  } catch (error) {
    log(`⚠️  Não foi possível commitar blog-auto.json: ${error.message}`, 'yellow');
  }
}

async function deployViaSsh(sshConfig, distPath) {
  const remote = `${sshConfig.user}@${sshConfig.host}`;
  const remoteDir = sshConfig.remoteDir.replace(/\/$/, '');
  const distPosix = distPath.replace(/\\/g, '/');
  const remoteCommand = `mkdir -p ${remoteDir} && tar -C ${remoteDir} -xf -`;
  const ssh = buildSshInvocation(sshConfig, remote, remoteCommand);

  log('📤 Deploy via SSH (recomendado na KingHost dedicada)', 'blue');
  log(`   ${remote}:${remoteDir}/`, 'blue');
  if (ssh.mode === 'key') {
    log('   Autenticação: chave SSH', 'blue');
  } else if (ssh.mode === 'sshpass') {
    log('   Autenticação: SSH_PASSWORD (sshpass)', 'blue');
  } else if (ssh.mode === 'ssh2') {
    log('   Autenticação: SSH_PASSWORD (ssh2, sem prompt)', 'blue');
  } else {
    log('   Autenticação: senha interativa (ou configure SSH_KEY_PATH)', 'yellow');
    log('   Dica: rode npm run deploy:ssh-setup uma vez para não digitar senha', 'yellow');
  }

  if (ssh.mode === 'ssh2') {
    log('   Enviando pacote compactado...', 'yellow');
    await deployTarViaSshPassword({
      host: sshConfig.host,
      user: sshConfig.user,
      password: sshConfig.password,
      remoteDir,
      localDir: distPath,
      onProgress: (message) => log(message, 'yellow'),
    });
    log('\n✅ Deploy SSH concluído!', 'green');
    return;
  }

  const tarExcludes = tarExcludeShellFlags();
  const cmd = `tar -C ${shellQuote(distPosix)} ${tarExcludes} -cf - . | ${ssh.command}`;
  log('   Enviando pacote compactado...', 'yellow');
  execSync(cmd, {
    stdio: 'inherit',
    cwd: rootDir,
    shell: true,
    env: { ...process.env, ...ssh.env },
  });
  log('\n✅ Deploy SSH concluído!', 'green');
}

async function deploy() {
  try {
    log('🚀 Iniciando deploy local...\n', 'blue');

    // 1. Verificar dependências
    log('📦 Verificando dependências...', 'blue');
    if (!existsSync(join(rootDir, 'node_modules'))) {
      log('📥 Instalando dependências...', 'yellow');
      execSync('npm install', { stdio: 'inherit', cwd: rootDir });
    }
    log('✅ Dependências OK\n', 'green');

    // 2. Carregar configurações
    const env = loadEnv();
    log('🔧 Variáveis de ambiente carregadas', 'green');
    
    const deployConfig = loadDeployConfig();
    log(
      deployConfig.method === 'ssh'
        ? '🔐 Deploy via SSH configurado\n'
        : '🔐 Configuração FTP carregada\n',
      'green'
    );

    commitBlogAutoIfChanged();
    log('', 'reset');

    // 3. Gerar build
    log('🔨 Gerando build de produção...', 'blue');
    process.env.VITE_API_BASE_URL = env.VITE_API_BASE_URL;
    process.env.VITE_API_TIMEOUT = env.VITE_API_TIMEOUT;
    process.env.VITE_BASE_PATH = env.VITE_BASE_PATH;
    process.env.VITE_SOCIAL_API_BASE_URL =
      env.VITE_SOCIAL_API_BASE_URL || 'https://www.netcarmultimarcas.com.br/social/v1';
    process.env.VITE_USE_NETCAR_SOCIAL = env.VITE_USE_NETCAR_SOCIAL || 'true';
    if (env.VITE_GOOGLE_MAPS_API_KEY) {
      process.env.VITE_GOOGLE_MAPS_API_KEY = env.VITE_GOOGLE_MAPS_API_KEY;
    }
    
    execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
    log('✅ Build gerado com sucesso\n', 'green');

    // 4. Verificar pasta dist
    const distPath = join(rootDir, 'dist');
    if (!existsSync(distPath)) {
      log('❌ Pasta dist/ não foi criada!', 'red');
      process.exit(1);
    }

    // 5. Registrar build no Git da pasta dist
    commitDistBuild(distPath);
    log('', 'reset'); // Linha em branco

    // 6. Upload
    if (deployConfig.method === 'ssh') {
      await deployViaSsh(deployConfig.ssh, distPath);
    } else if (ftp) {
      const ftpConfig = deployConfig.ftp;
      // Upload automático usando basic-ftp
      log('🚀 Conectando ao servidor FTP...', 'blue');
      log(`   Servidor: ${ftpConfig.server}`, 'blue');
      log(`   Usuário: ${ftpConfig.username}`, 'blue');

      const client = createFtpClient();

      try {
        await connectFtp(client, ftpConfig);
        log('✅ Conectado ao servidor FTP', 'green');
        log(`📁 Diretório remoto: ${ftpConfig.serverDir}`, 'blue');

        function getAllFiles(dirPath, arrayOfFiles = []) {
          const filesInDir = readdirSync(dirPath);
          filesInDir.forEach((file) => {
            if (file === '.git' || file === '.gitignore') {
              return;
            }

            const filePath = join(dirPath, file);
            if (statSync(filePath).isDirectory()) {
              getAllFiles(filePath, arrayOfFiles);
            } else if (
              !file.startsWith('.git-') &&
              !file.endsWith('.tmp') &&
              !file.endsWith('.log')
            ) {
              arrayOfFiles.push(filePath);
            }
          });
          return arrayOfFiles;
        }

        const allFiles = getAllFiles(distPath).sort((a, b) => {
          const aName = a.replace(/\\/g, "/").split("/").pop() || "";
          const bName = b.replace(/\\/g, "/").split("/").pop() || "";
          const deployLast = (name) =>
            name === "index.html" || name === "index.php" ? 1 : 0;
          return deployLast(aName) - deployLast(bName);
        });
        log(`📊 Total de arquivos para upload: ${allFiles.length}`, 'blue');

        const { uploadedCount, failedFiles, totalFiles } = await uploadDistFiles(
          client,
          ftpConfig,
          distPath,
          allFiles
        );

        log(`\n✅ Upload concluído: ${uploadedCount}/${totalFiles} arquivos enviados`, 'green');

        if (failedFiles.length > 0) {
          log(`\n❌ ${failedFiles.length} arquivo(s) não enviado(s):`, 'red');
          failedFiles.slice(0, 15).forEach((f) => log(`   - ${f}`, 'red'));
          if (failedFiles.length > 15) {
            log(`   ... e mais ${failedFiles.length - 15}`, 'red');
          }
          log('\n💡 Rode npm run deploy:local novamente — só os que faltam serão reenviados.', 'yellow');
          process.exit(1);
        }

        log('\n✅ Deploy concluído com sucesso!', 'green');
        log('🌐 Site atualizado no servidor', 'green');

      } catch (ftpError) {
        log(`\n❌ Erro ao fazer upload via FTP: ${ftpError.message}`, 'red');
        log('\n💡 Possíveis causas:', 'yellow');
        log('   - Credenciais FTP incorretas', 'yellow');
        log('   - Servidor FTP inacessível', 'yellow');
        log('   - Diretório FTP incorreto', 'yellow');
        log('   - Firewall bloqueando conexão', 'yellow');
        log('\n📤 Alternativa: use DEPLOY_METHOD=ssh no .env.local (recomendado)', 'yellow');
        log('   Ou upload manual via FileZilla', 'yellow');
        process.exit(1);
      } finally {
        try {
          client.close();
        } catch (e) {
          // Ignorar erro ao fechar conexão
        }
      }
    } else {
      const ftpConfig = deployConfig.ftp;
      // Instruções para upload manual
      log('\n📤 Upload Manual Necessário', 'yellow');
      log('\n============================================================', 'blue');
      log('✅ BUILD PRONTO PARA DEPLOY!', 'green');
      log('============================================================', 'blue');
      log('\n📁 Pasta de build: dist/', 'blue');
      log('\n📤 Para fazer upload automático, instale basic-ftp:', 'yellow');
      log('   npm install --save-dev basic-ftp', 'yellow');
      log('   E então execute: npm run deploy:local', 'yellow');
      log('\n📤 Ou faça upload manual via FileZilla:', 'yellow');
      log(`   1. Abra FileZilla`, 'yellow');
      log(`   2. Conecte ao servidor: ${ftpConfig.server}`, 'yellow');
      log(`   3. Usuário: ${ftpConfig.username}`, 'yellow');
      log(`   4. Navegue até: ${ftpConfig.serverDir}`, 'yellow');
      log(`   5. Faça upload de TODOS os arquivos da pasta dist/`, 'yellow');
      log('\n============================================================\n', 'blue');
    }

  } catch (error) {
    log(`\n❌ Erro durante deploy: ${error.message}`, 'red');
    process.exit(1);
  }
}

deploy();
