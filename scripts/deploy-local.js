#!/usr/bin/env node

/**
 * Script de Deploy Local para KingHost
 * Executa build e upload via FTP da sua máquina (IP nacional)
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

// Carregar configurações FTP
function loadFTPConfig() {
  // Tentar carregar de variáveis de ambiente ou arquivo .env.local
  let ftpConfig = {
    server: process.env.FTP_SERVER || '',
    username: process.env.FTP_USERNAME || '',
    password: process.env.FTP_PASSWORD || '',
    serverDir: process.env.FTP_SERVER_DIR || '/www/',
  };

  // Tentar carregar do .env.local
  const envLocalPath = join(rootDir, '.env.local');
  if (existsSync(envLocalPath)) {
    const envContent = readFileSync(envLocalPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        if (key === 'FTP_SERVER') ftpConfig.server = value;
        if (key === 'FTP_USERNAME') ftpConfig.username = value;
        if (key === 'FTP_PASSWORD') ftpConfig.password = value;
        if (key === 'FTP_SERVER_DIR') ftpConfig.serverDir = value;
      }
    });
  }

  // Verificar se está configurado
  if (!ftpConfig.server || !ftpConfig.username || !ftpConfig.password) {
    log('❌ Configuração FTP não encontrada!', 'red');
    log('\n📋 Crie um arquivo .env.local na raiz do projeto com:', 'yellow');
    log('   FTP_SERVER=ftp.seusite.com.br', 'yellow');
    log('   FTP_USERNAME=seu_usuario', 'yellow');
    log('   FTP_PASSWORD=sua_senha', 'yellow');
    log('   FTP_SERVER_DIR=/www/', 'yellow');
    log('\n💡 Ou configure variáveis de ambiente do sistema', 'yellow');
    process.exit(1);
  }

  return ftpConfig;
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
    
    const ftpConfig = loadFTPConfig();
    log('🔐 Configuração FTP carregada\n', 'green');

    // 3. Gerar build
    log('🔨 Gerando build de produção...', 'blue');
    process.env.VITE_API_BASE_URL = env.VITE_API_BASE_URL;
    process.env.VITE_API_TIMEOUT = env.VITE_API_TIMEOUT;
    process.env.VITE_BASE_PATH = env.VITE_BASE_PATH;
    
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

    // 6. Upload via FTP
    if (ftp) {
      // Upload automático usando basic-ftp
      log('🚀 Conectando ao servidor FTP...', 'blue');
      log(`   Servidor: ${ftpConfig.server}`, 'blue');
      log(`   Usuário: ${ftpConfig.username}`, 'blue');
      
      const client = new ftp.Client();
      client.ftp.verbose = false; // Desabilitar verbose para logs mais limpos
      client.ftp.timeout = 60000; // Timeout de 60 segundos

      try {
        await client.access({
          host: ftpConfig.server,
          user: ftpConfig.username,
          password: ftpConfig.password,
          secure: false, // FTP padrão (não FTPS)
        });

        log('✅ Conectado ao servidor FTP', 'green');

        // Navegar para o diretório do servidor
        log(`📁 Navegando para: ${ftpConfig.serverDir}`, 'blue');
        try {
          await client.cd(ftpConfig.serverDir);
          log('✅ Diretório acessado', 'green');
        } catch (cdError) {
          log(`⚠️  Erro ao acessar diretório: ${cdError.message}`, 'yellow');
          log('📁 Tentando criar diretório...', 'blue');
          await client.ensureDir(ftpConfig.serverDir);
          await client.cd(ftpConfig.serverDir);
          log('✅ Diretório criado e acessado', 'green');
        }

        // Contar arquivos antes do upload
        function getAllFiles(dirPath, arrayOfFiles = []) {
          const filesInDir = readdirSync(dirPath);
          filesInDir.forEach(file => {
            const filePath = join(dirPath, file);
            if (statSync(filePath).isDirectory()) {
              arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
            } else {
              arrayOfFiles.push(filePath);
            }
          });
          return arrayOfFiles;
        }
        const allFiles = getAllFiles(distPath);
        log(`📊 Total de arquivos para upload: ${allFiles.length}`, 'blue');

        // Upload de todos os arquivos com progresso
        log('📤 Fazendo upload dos arquivos...', 'blue');
        log('   (Isso pode levar alguns minutos dependendo da quantidade de arquivos)', 'yellow');
        
        let uploadedCount = 0;
        const totalFiles = allFiles.length;

        // Upload arquivo por arquivo para melhor controle
        for (const filePath of allFiles) {
          const relativePath = filePath.replace(distPath + '/', '').replace(/\\/g, '/');
          const dirPath = relativePath.split('/').slice(0, -1).join('/');
          
          let retries = 3;
          let uploaded = false;
          
          while (retries > 0 && !uploaded) {
            try {
              // Criar diretórios se necessário
              if (dirPath) {
                await client.ensureDir(ftpConfig.serverDir + '/' + dirPath);
              }
              
              // Fazer upload do arquivo
              await client.uploadFrom(filePath, ftpConfig.serverDir + '/' + relativePath);
              uploaded = true;
              uploadedCount++;
              
              if (uploadedCount % 10 === 0 || uploadedCount === totalFiles) {
                log(`   Progresso: ${uploadedCount}/${totalFiles} arquivos (${Math.round(uploadedCount/totalFiles*100)}%)`, 'blue');
              }
            } catch (fileError) {
              retries--;
              if (retries > 0) {
                log(`   ⚠️  Erro ao fazer upload de ${relativePath}, tentando novamente... (${retries} tentativas restantes)`, 'yellow');
                await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo antes de retry
              } else {
                log(`   ❌ Falha ao fazer upload de ${relativePath}: ${fileError.message}`, 'red');
              }
            }
          }
        }

        log(`\n✅ Upload concluído: ${uploadedCount}/${totalFiles} arquivos enviados`, 'green');
        
        if (uploadedCount < totalFiles) {
          log(`⚠️  Atenção: ${totalFiles - uploadedCount} arquivos não foram enviados`, 'yellow');
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
        log('\n📤 Alternativa: Faça upload manual via FileZilla', 'yellow');
        process.exit(1);
      } finally {
        try {
          client.close();
        } catch (e) {
          // Ignorar erro ao fechar conexão
        }
      }
    } else {
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
