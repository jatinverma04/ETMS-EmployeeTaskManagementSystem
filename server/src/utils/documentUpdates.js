/**
 * Cross-field Mongoose validators depend on the complete document state. Update
 * services must load the document and use these helpers instead of update queries
 * such as findOneAndUpdate, which do not reliably run contextual validators.
 */
function applyDocumentChanges(document, changes) {
  if (!document || typeof document.save !== 'function' || !document.schema) {
    throw new TypeError('A Mongoose document is required to apply changes.');
  }

  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw new TypeError('Document changes must be an object.');
  }

  Object.assign(document, changes);

  return document;
}

async function saveDocumentChanges(document, changes, { session } = {}) {
  const updatedDocument = applyDocumentChanges(document, changes);

  return session ? updatedDocument.save({ session }) : updatedDocument.save();
}

module.exports = {
  applyDocumentChanges,
  saveDocumentChanges,
};
