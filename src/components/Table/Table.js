import React from 'react';
import './Table.css';

const Table = ({ columns, data, onRowClick, actions }) => {
  return (
    <>
      {/* Desktop Table View */}
      <div className="table-container table-desktop">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ width: col.width }}>
                  {col.label}
                </th>
              ))}
              {actions && <th style={{ width: '100px' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="table-empty">
                  No data available
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr 
                  key={row.id || index} 
                  onClick={() => onRowClick && onRowClick(row)}
                  className={onRowClick ? 'table-row-clickable' : ''}
                >
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                  {actions && (
                    <td>
                      <div className="table-actions">
                        {actions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="table-mobile">
        {data.length === 0 ? (
          <div className="table-empty-mobile">
            No data available
          </div>
        ) : (
          data.map((row, index) => (
            <div 
              key={row.id || index}
              className={`table-card ${onRowClick ? 'table-card-clickable' : ''}`}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((col) => (
                <div key={col.key} className="table-card-row">
                  <div className="table-card-label">{col.label}</div>
                  <div className="table-card-value">
                    {col.render ? col.render(row[col.key], row) : row[col.key] || '-'}
                  </div>
                </div>
              ))}
              {actions && (
                <div className="table-card-actions">
                  {actions(row)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default Table;

