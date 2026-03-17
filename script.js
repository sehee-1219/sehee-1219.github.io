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
  connectionPill.textContent = kind === "success" ? "Connected" : kind === "error" ? "Error" : "Ready";
  connectionText.textContent = message;
}

function writeLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  logEntries.unshift(`[${timestamp}] ${message}`);
  activityLog.textContent = logEntries.slice(0, 12).join("\n");
}

function writeSession(session) {
  currentSession = session;

  if (!session) {
    sessionSummary.textContent = "No active session.";
    sessionOutput.textContent = "null";
    syncActionState();
    renderPosts(currentPosts);
    return;
  }

  const email = session.user?.email ?? "unknown user";
  sessionSummary.textContent = `Signed in as ${email}.`;
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

  const message = "Supabase client is not ready yet.";
  setAuthFeedback(message);
  setStatus("error", message);
  writeLog(message);
  return false;
}

function syncActionState() {
  const clientReady = Boolean(supabaseClient);

  signUpButton.disabled = isBusy || !clientReady;
  signInButton.disabled = isBusy || !clientReady;
  signOutButton.disabled = isBusy || !clientReady || !currentSession;
  publishButton.disabled = isBusy || !clientReady || !currentSession;
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
    throw new Error("Enter both email and password.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  return { email, password };
}

function getPostPayload() {
  if (!currentSession) {
    throw new Error("Sign in first to publish a post.");
  }

  const authorName =
    authorNameInput.value.trim() ||
    currentSession.user?.email?.split("@")[0] ||
    "";
  const title = postTitleInput.value.trim();
  const content = postContentInput.value.trim();

  if (!authorName) {
    throw new Error("Enter a display name.");
  }

  if (!title) {
    throw new Error("Enter a title.");
  }

  if (!content) {
    throw new Error("Enter post content.");
  }

  if (authorName.length > 40) {
    throw new Error("Display name must be 40 characters or fewer.");
  }

  if (title.length > 120) {
    throw new Error("Title must be 120 characters or fewer.");
  }

  if (content.length > 2000) {
    throw new Error("Content must be 2000 characters or fewer.");
  }

  return {
    user_id: currentSession.user.id,
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
    emptyState.textContent = "No posts yet. Create the table, sign in, and publish the first one.";
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
    meta.textContent = `${post.author_name} - ${new Date(post.created_at).toLocaleString()}`;

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
      deleteButton.textContent = "Delete";

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
        ? "You can publish a new post or delete your own posts."
        : "Read access is public. Sign in to publish."
    );
    setStatus("success", `Loaded ${currentPosts.length} posts from ${BOARD_TABLE}.`);
    writeLog(`Loaded ${currentPosts.length} posts.`);
  } catch (error) {
    currentPosts = [];
    renderPosts(currentPosts);
    setBoardFeedback(`Post load failed: ${error.message}`);
    setStatus("error", `Could not read ${BOARD_TABLE}.`);
    writeLog(`Post load failed: ${error.message}`);
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
      setAuthFeedback("Sign-up completed and session created.");
      setStatus("success", "Supabase auth is working from GitHub Pages.");
      writeLog(`Signed up and logged in as ${email}.`);
      return;
    }

    setAuthFeedback(
      "Sign-up submitted. Check email if confirmation is enabled."
    );
    setStatus("success", "Supabase accepted the sign-up request.");
    writeLog(`Sign-up submitted for ${email}.`);
  } catch (error) {
    setAuthFeedback(error.message);
    setStatus("error", "Supabase auth returned an error.");
    writeLog(`Sign-up failed: ${error.message}`);
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
    setAuthFeedback("Sign-in completed.");
    setStatus("success", "Supabase auth session is active.");
    writeLog(`Signed in as ${email}.`);
  } catch (error) {
    setAuthFeedback(error.message);
    setStatus("error", "Supabase sign-in failed.");
    writeLog(`Sign-in failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function signOut() {
  if (!ensureClient()) {
    return;
  }

  setBusy(true);

  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      throw error;
    }

    writeSession(null);
    setAuthFeedback("Signed out.");
    setStatus("success", "Client is still connected. Session cleared.");
    writeLog("Signed out.");
  } catch (error) {
    setAuthFeedback(error.message);
    setStatus("error", "Supabase sign-out failed.");
    writeLog(`Sign-out failed: ${error.message}`);
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
    setBoardFeedback("Post published.");
    setStatus("success", `New post added to ${BOARD_TABLE}.`);
    writeLog(`Created post "${payload.title}".`);
    await loadPosts({ keepBusy: true });
  } catch (error) {
    setBoardFeedback(error.message);
    setStatus("error", `Could not insert into ${BOARD_TABLE}.`);
    writeLog(`Post creation failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function deletePost(postId, title) {
  if (!ensureClient()) {
    return;
  }

  if (!window.confirm(`Delete "${title}"?`)) {
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

    setBoardFeedback("Post deleted.");
    setStatus("success", "Post deleted.");
    writeLog(`Deleted post "${title}".`);
    await loadPosts({ keepBusy: true });
  } catch (error) {
    setBoardFeedback(error.message);
    setStatus("error", `Could not delete from ${BOARD_TABLE}.`);
    writeLog(`Post delete failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function initializeSupabase() {
  setBusy(true);

  if (!window.supabase?.createClient) {
    setStatus("error", "Supabase library failed to load.");
    writeLog("Supabase CDN script did not initialize.");
    setBusy(false);
    return;
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLIC_KEY
  );

  setStatus("idle", "Supabase client initialized. Sign in to publish or read the board publicly.");
  writeLog("Supabase client initialized.");
  setAuthFeedback("Use email/password auth from Supabase.");
  setBoardFeedback("Run supabase-board.sql once, then refresh.");

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setAuthFeedback(error.message);
    writeLog(`Initial session read failed: ${error.message}`);
  } else {
    writeSession(data.session ?? null);
    writeLog(data.session ? "Recovered existing session." : "No existing session.");
  }

  await loadPosts({ keepBusy: true });

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    writeSession(session);
    if (event === "SIGNED_IN") {
      setAuthFeedback("Sign-in completed.");
    } else if (event === "SIGNED_OUT") {
      setAuthFeedback("Signed out.");
    }
    writeLog(`Auth event: ${event}`);

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
  setStatus("error", "Supabase initialization failed.");
  writeLog(`Initialization failed: ${error.message}`);
});
