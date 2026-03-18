/**
 * Thermomix Tasks — Google Apps Script API
 *
 * Setup:
 * 1. Create a new Google Sheet
 * 2. Rename the first sheet tab to "Tasks"
 * 3. Add headers in row 1: ID | Task | Status | Priority | Notes | Added | Completed
 * 4. Open Extensions → Apps Script
 * 5. Paste this entire script
 * 6. Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. Copy the deployment URL
 * 8. Add the URL to your Claude.ai Project instructions and to .claude/docs/PROJECT.md
 *
 * API Usage:
 *
 * GET  ?action=list                    → all tasks
 * GET  ?action=list&status=pending     → only pending tasks
 * GET  ?action=get&id=3                → single task by ID
 * POST {action:"add", task:"...", priority:"high", notes:"..."}  → add task
 * POST {action:"update", id:3, status:"done", notes:"..."}      → update task
 * POST {action:"delete", id:3}                                   → delete task
 */

const SHEET_NAME = "Tasks";
const HEADERS = ["ID", "Task", "Status", "Priority", "Notes", "Added", "Completed"];

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getNextId(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 1;
  const ids = data.slice(1).map(row => Number(row[0]) || 0);
  return Math.max(...ids) + 1;
}

function rowToTask(row) {
  return {
    id: row[0],
    task: row[1],
    status: row[2],
    priority: row[3],
    notes: row[4],
    added: row[5],
    completed: row[6]
  };
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GET handler ──

function doGet(e) {
  const action = (e.parameter.action || "list").toLowerCase();
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const tasks = data.slice(1).map(rowToTask);

  if (action === "list") {
    const statusFilter = (e.parameter.status || "").toLowerCase();
    const filtered = statusFilter
      ? tasks.filter(t => t.status.toString().toLowerCase() === statusFilter)
      : tasks;
    return jsonResponse({ ok: true, count: filtered.length, tasks: filtered });
  }

  if (action === "get") {
    const id = Number(e.parameter.id);
    const task = tasks.find(t => Number(t.id) === id);
    if (!task) return jsonResponse({ ok: false, error: "Task not found" });
    return jsonResponse({ ok: true, task: task });
  }

  return jsonResponse({ ok: false, error: "Unknown action: " + action });
}

// ── POST handler ──

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, error: "Invalid JSON" });
  }

  const action = (body.action || "").toLowerCase();
  const sheet = getSheet();

  // ── Add task ──
  if (action === "add") {
    if (!body.task) return jsonResponse({ ok: false, error: "Missing 'task' field" });
    const id = getNextId(sheet);
    const now = new Date().toISOString();
    const row = [
      id,
      body.task,
      body.status || "pending",
      body.priority || "normal",
      body.notes || "",
      now,
      ""
    ];
    sheet.appendRow(row);
    return jsonResponse({ ok: true, id: id, message: "Task added" });
  }

  // ── Update task ──
  if (action === "update") {
    const id = Number(body.id);
    if (!id) return jsonResponse({ ok: false, error: "Missing 'id' field" });
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (Number(data[i][0]) === id) {
        const rowNum = i + 1;
        if (body.task !== undefined) sheet.getRange(rowNum, 2).setValue(body.task);
        if (body.status !== undefined) {
          sheet.getRange(rowNum, 3).setValue(body.status);
          if (body.status.toLowerCase() === "done") {
            sheet.getRange(rowNum, 7).setValue(new Date().toISOString());
          }
        }
        if (body.priority !== undefined) sheet.getRange(rowNum, 4).setValue(body.priority);
        if (body.notes !== undefined) sheet.getRange(rowNum, 5).setValue(body.notes);
        return jsonResponse({ ok: true, message: "Task " + id + " updated" });
      }
    }
    return jsonResponse({ ok: false, error: "Task " + id + " not found" });
  }

  // ── Delete task ──
  if (action === "delete") {
    const id = Number(body.id);
    if (!id) return jsonResponse({ ok: false, error: "Missing 'id' field" });
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (Number(data[i][0]) === id) {
        sheet.deleteRow(i + 1);
        return jsonResponse({ ok: true, message: "Task " + id + " deleted" });
      }
    }
    return jsonResponse({ ok: false, error: "Task " + id + " not found" });
  }

  return jsonResponse({ ok: false, error: "Unknown action: " + action });
}
