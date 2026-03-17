const SUPABASE_URL = "https://fppakfwjnflpraokazvq.supabase.co";
const SUPABASE_PUBLIC_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcGFrZndqbmZscHJhb2thenZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTU2NDksImV4cCI6MjA4OTI3MTY0OX0.YOLW9Fm02UE49ij7gN98QtZ4dsWFHvFo5kkV8-GxfW0";
const BOARD_TABLE = "board_posts";

document.getElementById("year").textContent = new Date().getFullYear();

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    }
  },
  { threshold: 0.18 }
);

document.querySelectorAll(".reveal").forEach((element) => {
  observer.observe(element);
});

const connectionPill = document.getElementById("connection-pill");
const connectionText = document.getElementById("connection-text");
const authFeedback = document.getElementById("auth-feedback");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signUpButton = document.getElementById("sign-up-button");
const signInButton = document.getElementById("sign-in-button");
const signOutButton = document.getElementById("sign-out-button");
const authorNameInput = document.getElementById("author-name");
const postTitleInput = document.getElementById("post-title");
const postContentInput = document.getElementById("post-content");
const publishButton = document.getElementById("publish-button");
const boardFeedback = document.getElementById("board-feedback");
const refreshPostsButton = document.getElementById("refresh-posts-button");
const postsList = document.getElementById("posts-list");
const sessionSummary = document.getElementById("session-summary");
const sessionOutput = document.getElementById("session-output");
const activityLog = document.getElementById("activity-log");

let supabaseClient;
let currentSession = null;
let currentPosts = [];
let isBusy = false;
const logEntries = [];

function setStatus(kind, message) {
  connectionPill.className = `status-pill ${kind}`;
  connectionPill.textContent = kind === "success" ? "연결됨" : kind === "error" ? "오류" : "준비됨";
  connectionText.textContent = message;
}

function writeLog(message) {
  const timestamp = new Date().toLocaleTimeString("ko-KR");
  logEntries.unshift(`[${timestamp}] ${message}`);
  activityLog.textContent = logEntries.slice(0, 12).join("\n");
}

function writeSession(session) {
  currentSession = session;

  if (!session) {
    sessionSummary.textContent = "활성 세션이 없습니다.";
    sessionOutput.textContent = "null";
    syncActionState();
    renderPosts(currentPosts);
    return;
  }

  const email = session.user?.email ?? "알 수 없는 사용자";
  sessionSummary.textContent = `${email} 계정으로 로그인되어 있습니다.`;
  sessionOutput.textContent = JSON.stringify(
    {
      user: {
        id: session.user?.id,
        email,
        last_sign_in_at: session.user?.last_sign_in_at ?? null,
      },
      expires_at: session.expires_at ?? null,
    },
    null,
    2
  );

  if (!authorNameInput.value.trim() && session.user?.email) {
    authorNameInput.value = session.user.email.split("@")[0];
  }

  syncActionState();
  renderPosts(currentPosts);
}

function setAuthFeedback(message) {
  authFeedback.textContent = message;
}

function setBoardFeedback(message) {
  boardFeedback.textContent = message;
}

function ensureClient() {
  if (supabaseClient) {
    return true;
  }

  const message = "Supabase 클라이언트가 아직 준비되지 않았습니다.";
  setAuthFeedback(message);
  setStatus("error", message);
  writeLog(message);
  return false;
}

function syncActionState() {
  const clientReady = Boolean(supabaseClient);

  signUpButton.disabled = isBusy || !clientReady;
  signInButton.disabled = isBusy || !clientReady;
  signOutButton.disabled = isBusy || !clientReady;
  publishButton.disabled = isBusy || !clientReady;
  refreshPostsButton.disabled = isBusy || !clientReady;

  document.querySelectorAll("[data-delete-post]").forEach((button) => {
    button.disabled = isBusy;
  });
}

function setBusy(nextBusy) {
  isBusy = nextBusy;
  syncActionState();
}

function getCredentials() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    throw new Error("이메일과 비밀번호를 모두 입력하세요.");
  }

  if (password.length < 6) {
    throw new Error("비밀번호는 최소 6자 이상이어야 합니다.");
  }

  return { email, password };
}

function getPostPayload() {
  const authorName =
    authorNameInput.value.trim() ||
    currentSession?.user?.email?.split("@")[0] ||
    "";
  const title = postTitleInput.value.trim();
  const content = postContentInput.value.trim();

  if (!authorName) {
    throw new Error("작성자 이름을 입력하세요.");
  }

  if (!title) {
    throw new Error("제목을 입력하세요.");
  }

  if (!content) {
    throw new Error("게시글 내용을 입력하세요.");
  }

  if (authorName.length > 40) {
    throw new Error("작성자 이름은 40자 이하로 입력하세요.");
  }

  if (title.length > 120) {
    throw new Error("제목은 120자 이하로 입력하세요.");
  }

  if (content.length > 2000) {
    throw new Error("내용은 2000자 이하로 입력하세요.");
  }

  return {
    user_id: currentSession?.user?.id ?? null,
    author_name: authorName,
    title,
    content,
  };
}

function renderPosts(posts) {
  postsList.replaceChildren();

  if (!posts.length) {
    const emptyState = document.createElement("article");
    emptyState.className = "empty-state";
    emptyState.textContent = "아직 게시글이 없습니다. 로그인 없이도 첫 글을 작성할 수 있습니다.";
    postsList.append(emptyState);
    syncActionState();
    return;
  }

  for (const post of posts) {
    const article = document.createElement("article");
    article.className = "post-card";

    const topline = document.createElement("div");
    topline.className = "post-topline";

    const title = document.createElement("h3");
    title.textContent = post.title;

    const meta = document.createElement("p");
    meta.className = "post-meta";
    meta.textContent = `${post.author_name} - ${new Date(post.created_at).toLocaleString("ko-KR")}`;

    const content = document.createElement("p");
    content.className = "post-content";
    content.textContent = post.content;

    topline.append(title);
    article.append(topline, meta, content);

    if (currentSession?.user?.id === post.user_id) {
      const actions = document.createElement("div");
      actions.className = "post-actions";

      const deleteButton = document.createElement("button");
      deleteButton.className = "button ghost";
      deleteButton.type = "button";
      deleteButton.dataset.deletePost = post.id;
      deleteButton.dataset.title = post.title;
      deleteButton.textContent = "삭제";

      actions.append(deleteButton);
      article.append(actions);
    }

    postsList.append(article);
  }

  syncActionState();
}

async function loadPosts(options = {}) {
  if (!ensureClient()) {
    return;
  }

  const keepBusy = options.keepBusy ?? false;
  if (!keepBusy) {
    setBusy(true);
  }

  try {
    const { data, error } = await supabaseClient
      .from(BOARD_TABLE)
      .select("id, user_id, author_name, title, content, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    currentPosts = data ?? [];
    renderPosts(currentPosts);
    setBoardFeedback(
      currentSession
        ? "로그인 상태에서는 글을 쓰고 내 글을 삭제할 수 있습니다."
        : "로그인 없이도 글을 쓸 수 있습니다. 익명 글은 이 페이지에서 삭제할 수 없습니다."
    );
    setStatus("success", `${BOARD_TABLE} 에서 게시글 ${currentPosts.length}개를 불러왔습니다.`);
    writeLog(`게시글 ${currentPosts.length}개를 불러왔습니다.`);
  } catch (error) {
    currentPosts = [];
    renderPosts(currentPosts);
    setBoardFeedback(`게시글을 불러오지 못했습니다: ${error.message}`);
    setStatus("error", `${BOARD_TABLE} 을(를) 읽지 못했습니다.`);
    writeLog(`게시글 불러오기 실패: ${error.message}`);
  } finally {
    if (!keepBusy) {
      setBusy(false);
    }
  }
}

async function signUp() {
  if (!ensureClient()) {
    return;
  }

  let credentials;

  try {
    credentials = getCredentials();
  } catch (error) {
    setAuthFeedback(error.message);
    return;
  }

  const { email, password } = credentials;
  setBusy(true);

  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      throw error;
    }

    writeSession(data.session ?? null);

    if (data.session) {
      setAuthFeedback("회원가입이 완료되었고 세션도 생성되었습니다.");
      setStatus("success", "GitHub Pages에서 Supabase 인증이 정상 동작합니다.");
      writeLog(`${email} 계정으로 회원가입 후 로그인했습니다.`);
      return;
    }

    setAuthFeedback(
      "회원가입 요청을 보냈습니다. 이메일 인증이 켜져 있으면 메일을 확인하세요."
    );
    setStatus("success", "Supabase가 회원가입 요청을 받았습니다.");
    writeLog(`${email} 계정에 대한 회원가입 요청을 보냈습니다.`);
  } catch (error) {
    setAuthFeedback(error.message);
    setStatus("error", "Supabase 인증 처리 중 오류가 발생했습니다.");
    writeLog(`회원가입 실패: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function signIn() {
  if (!ensureClient()) {
    return;
  }

  let credentials;

  try {
    credentials = getCredentials();
  } catch (error) {
    setAuthFeedback(error.message);
    return;
  }

  const { email, password } = credentials;
  setBusy(true);

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    writeSession(data.session ?? null);
    setAuthFeedback("로그인이 완료되었습니다.");
    setStatus("success", "Supabase 인증 세션이 활성화되었습니다.");
    writeLog(`${email} 계정으로 로그인했습니다.`);
  } catch (error) {
    setAuthFeedback(error.message);
    setStatus("error", "Supabase 로그인에 실패했습니다.");
    writeLog(`로그인 실패: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function signOut() {
  if (!ensureClient()) {
    return;
  }

  if (!currentSession) {
    setAuthFeedback("현재 로그인된 상태가 아닙니다.");
    setStatus("idle", "로그인 세션이 없어도 게시판은 계속 사용할 수 있습니다.");
    writeLog("로그아웃 요청이 있었지만 활성 세션이 없었습니다.");
    return;
  }

  setBusy(true);

  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      throw error;
    }

    writeSession(null);
    setAuthFeedback("로그아웃되었습니다.");
    setStatus("success", "연결은 유지된 상태에서 세션만 정리되었습니다.");
    writeLog("로그아웃했습니다.");
  } catch (error) {
    setAuthFeedback(error.message);
    setStatus("error", "Supabase 로그아웃에 실패했습니다.");
    writeLog(`로그아웃 실패: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function publishPost() {
  if (!ensureClient()) {
    return;
  }

  let payload;

  try {
    payload = getPostPayload();
  } catch (error) {
    setBoardFeedback(error.message);
    return;
  }

  setBusy(true);

  try {
    const { error } = await supabaseClient.from(BOARD_TABLE).insert([payload]);

    if (error) {
      throw error;
    }

    postTitleInput.value = "";
    postContentInput.value = "";
    setBoardFeedback(
      currentSession
        ? "게시글이 등록되었습니다."
        : "익명 게시글이 등록되었습니다."
    );
    setStatus("success", `${BOARD_TABLE} 에 새 글이 추가되었습니다.`);
    writeLog(`"${payload.title}" 게시글을 작성했습니다.`);
    await loadPosts({ keepBusy: true });
  } catch (error) {
    setBoardFeedback(error.message);
    setStatus("error", `${BOARD_TABLE} 에 글을 추가하지 못했습니다.`);
    writeLog(`게시글 작성 실패: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function deletePost(postId, title) {
  if (!ensureClient()) {
    return;
  }

  if (!window.confirm(`"${title}" 글을 삭제할까요?`)) {
    return;
  }

  setBusy(true);

  try {
    const { error } = await supabaseClient
      .from(BOARD_TABLE)
      .delete()
      .eq("id", postId);

    if (error) {
      throw error;
    }

    setBoardFeedback("게시글이 삭제되었습니다.");
    setStatus("success", "게시글이 삭제되었습니다.");
    writeLog(`"${title}" 게시글을 삭제했습니다.`);
    await loadPosts({ keepBusy: true });
  } catch (error) {
    setBoardFeedback(error.message);
    setStatus("error", `${BOARD_TABLE} 에서 글을 삭제하지 못했습니다.`);
    writeLog(`게시글 삭제 실패: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function initializeSupabase() {
  setBusy(true);

  if (!window.supabase?.createClient) {
    setStatus("error", "Supabase 라이브러리를 불러오지 못했습니다.");
    writeLog("Supabase CDN 스크립트가 초기화되지 않았습니다.");
    setBusy(false);
    return;
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLIC_KEY
  );

  setStatus("idle", "Supabase 클라이언트가 준비되었습니다. 로그인해서 글을 쓰거나 공개 게시글을 확인할 수 있습니다.");
  writeLog("Supabase 클라이언트를 초기화했습니다.");
  setAuthFeedback("로그인은 선택입니다. 원하면 이메일/비밀번호 인증을 사용할 수 있습니다.");
  setBoardFeedback("로그인 없이도 글을 쓸 수 있습니다. 먼저 supabase-board.sql 을 다시 실행한 뒤 새로고침하세요.");

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setAuthFeedback(error.message);
    writeLog(`초기 세션 조회 실패: ${error.message}`);
  } else {
    writeSession(data.session ?? null);
    writeLog(data.session ? "기존 세션을 복구했습니다." : "기존 세션이 없습니다.");
  }

  await loadPosts({ keepBusy: true });

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    writeSession(session);
    if (event === "SIGNED_IN") {
      setAuthFeedback("로그인이 완료되었습니다.");
    } else if (event === "SIGNED_OUT") {
      setAuthFeedback("로그아웃되었습니다.");
    }
    writeLog(`인증 이벤트: ${event}`);

    setBusy(true);
    try {
      await loadPosts({ keepBusy: true });
    } finally {
      setBusy(false);
    }
  });

  setBusy(false);
}

signUpButton.addEventListener("click", signUp);
signInButton.addEventListener("click", signIn);
signOutButton.addEventListener("click", signOut);
publishButton.addEventListener("click", publishPost);
refreshPostsButton.addEventListener("click", () => {
  loadPosts();
});
postsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-post]");
  if (!button) {
    return;
  }

  deletePost(button.dataset.deletePost, button.dataset.title);
});

initializeSupabase().catch((error) => {
  setBusy(false);
  setAuthFeedback(error.message);
  setBoardFeedback(error.message);
  setStatus("error", "Supabase 초기화에 실패했습니다.");
  writeLog(`초기화 실패: ${error.message}`);
});
